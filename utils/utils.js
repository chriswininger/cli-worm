const fs = require('fs')
const unzip = require('unzip')
const parse = require('xml-parser');
const { spawn } = require('child_process')
const path = require('path')
const { getLogger } = require(__dirname + '/utils.logger.js')

const logger = getLogger('debug')
const Utils = {}
module.exports = Object.assign(Utils, {
	getFileFromEPub(ePubPath, filePath) {
		return new Promise((resolve, reject) => {
			let found = false

			logger.debug(`looking for file ${filePath}`)
			fs.createReadStream(ePubPath)
				.pipe(unzip.Parse())
				.on('entry', function (entry) {
					// normalize for opening /
					const entryPath = entry.path[0] === '/' ? entry.path.slice(1) : entry.path
					filePath = filePath[0] === '/' ? filePath.slice(1) : filePath

					if (entry.type === 'File'  && entryPath === filePath.split('#')[0]) {
						found = true
						logger.debug('found file ' + filePath + ' begging gathering contents')

						let chp = ''
						entry.on('data', data => {
							chp += data.toString()
						})
						entry.on('end', () => {
							entry.removeAllListeners()
							entry.autodrain()
							logger.debug('done gathering contents of ' + filePath)
							resolve(chp)
						})
						entry.on('error', err => {
							logger.debug('failed to get contents for ' + filePath + ': ' + err)
							entry.autodrain()
							reject(err)
						})
					} else {
						logger.debug(`passing over ${entryPath} while searching for ${filePath}`)
						entry.autodrain()
					}
				})
				.on('close', () => {
					if (!found) {
						logger.debug('could not find: ' + filePath)
						reject('file not found: ' + filePath)
					} else {
						logger.debug('finished processing and found file')
					}
				})
				.on('error', err => {
					if (!found)
						reject(err)
				})
		})
	},
    getRootFile(ePubPath) {
		logger.debug(`getRootFile: ${ePubPath}`)
        return new Promise((resolve, reject) => {
        	Utils.getFileFromEPub(ePubPath, 'META-INF/container.xml')
				.then(xml => {
					const xmlObj = parse(xml)
					const filePath = xmlObj.root.children
						.find(child => child.name === 'rootfiles').children
						.find(child => child.name === 'rootfile').attributes['full-path']

					const folder = filePath.split(path.sep)[filePath.split(path.sep).length - 2] || ''
					logger.debug('resolved root file location (.opf): ' + filePath)
					logger.debug('resolved root folder name: ' + folder)
					resolve({ folder, filePath })
				})
				.catch(reject)
        })
    },
    getNCXFile(ePubPath, rootFilePath) {
		logger.debug(`getNCXFile: ${ePubPath}, ${rootFilePath}`)
		return new Promise((resolve, reject) => {
			logger.debug(`reading rootFile: "${rootFilePath}"`)
			const isChapterSpcifier = child => {
			  const attrs = child.attributes
			  return child.name === 'item' && attrs['media-type'] === 'application/x-dtbncx+xml'
			}

			Utils.getFileFromEPub(ePubPath, rootFilePath)
			  .then(xml => {
				  const xmlObj = parse(xml)

				  const manifestObj = xmlObj.root.children.find(child => child.name === 'manifest').children
				  const refObj = manifestObj.find(isChapterSpcifier)

				  if (!refObj)
					  return logger.debug('missing refObj: ' + JSON.stringify(manifestObj, null, 4))

				  const ref = refObj.attributes.href
				  resolve(ref)
			  })
			  .catch(reject)
		})
    },
    getChapters(ePubPath, chpLocation) {
		logger.debug(`getChapters: ${ePubPath}, ${chpLocation}`)

		// === Helpers
		const paddingForParts = '  '

		const extractChapters = (root, padding, lastChapter) => {
			if (typeof padding === 'undefined')
				padding = ''

			let list = []
			lastChapter = lastChapter || false

			root.children.filter(node => node.name === 'navPoint')
				.forEach(navPoint => {
                    const linkBlock = navPoint.children.find(p => p.name === 'content')
					const isSubChapter = lastChapter &&
					  lastChapter.split('#')[0] === linkBlock.attributes.src.split('#')[0]

					logger.debug(`isSubChapter:
						${isSubChapter},
						${padding + navPoint.children.find(p => p.name === 'navLabel').children.find(p => p.name === 'text').content},
						${linkBlock.attributes.src},
						${lastChapter},
						${lastChapter && lastChapter.split('#')[0]},
						${lastChapter && linkBlock.attributes.src.split('#')[0]}`)
					list.push({
						text: padding + navPoint.children.find(p => p.name === 'navLabel').children.find(p => p.name === 'text').content,
						link: linkBlock.attributes.src,
						isSubChapter
					})
					lastChapter = linkBlock.attributes.src

					// recur back for any nested chapters
					list = list.concat(extractChapters(navPoint, padding + paddingForParts, lastChapter))
				})

			return list
		}

        return new Promise((resolve, reject) => {
			Utils.getFileFromEPub(ePubPath, chpLocation)
				.then(contents => {
					// cheep hack, remove doctype because xml parser can't handle this
					const xml = Utils.stripDocType(contents)
					const obj = parse(xml);

					if (!obj.root)
						return reject(`failed to parse xml:\n\n ${xml}`)

					const list = extractChapters(obj.root.children.find(node => node.name === 'navMap'))
					resolve(list)
				})
				.catch(reject)
        })
    },
	getTitle(ePubPath, chpLocation) {
		logger.debug(`getTitle: ${ePubPath}, ${chpLocation}`)
		return new Promise(async (resolve, reject) => {
			try {
				const content = await Utils.getFileFromEPub(ePubPath, chpLocation)
				const xml = Utils.stripDocType(content)
				const obj = parse(xml)

				if (!obj.root)
					return reject(`failed to parse xml:\n\n ${xml}`)

				const titleNode = obj.root.children.find(node => node.name === 'docTitle')
				if (!titleNode)
					return resolve(null)

				const textNode = titleNode.children.find(node => node.name === 'text')

				if (!textNode)
					return resolve(null)

				resolve(textNode.content)
			} catch(ex) {
				reject(ex)
			}
		})
	},
    renderChapter(ePupFilePath, chpPath) {
		logger.debug(`renderChapter: ${ePupFilePath}, ${chpPath}`)
        return new Promise((resolve, reject) => {
        	// echo "<html><head><title>foo</title></head><body><h3>hello</h3></body></html>" | w3m -T text/html
			Utils.getFileFromEPub(ePupFilePath, chpPath)
				.then(chpContents => {
					const cmd = 'w3m' //`echo "${chpContents}" | w3m`
					logger.debug(cmd)
					const args = ['-T', 'text/html']
					let results = ''
					const errors = []

					logger.debug(`executing w3m command: "${cmd} ${args.join(' ')}`)
					const child = spawn(cmd, args) //spawn(cmd, args)
					child.stdin.setEncoding('utf-8')
					child.stdin.write(`${chpContents}\n`)
					child.stdin.end()

					child.stdout.on('data', data => {
						results += data
					})

					child.stderr.on('data', err => {
						errors.push('' + err)
					})

					child.on('close', code => {
						child.removeAllListeners()
						if (code !== 0 || errors.length > 0) {
							logger.debug('w3m completed with error code: ' + code + ', and errors:\n\n' + errors.join('\n'))
							reject('w3m closed with error:\n\n' + errors.join('\n'))
						} else {
							resolve(results)
						}
					})
				})
				.catch(reject)
        })
    },

	// use to strip and directives like !DOCTYPE from our file before we try to parse it as xml
	stripDocType(xml) {
		const location = xml.indexOf('<!DOCTYPE')
		if (location < 0)
			return xml

		const endLocation = xml.slice(location).indexOf('>') + location + 1
		return xml.slice(0, location) + xml.slice(endLocation)
	}
})
