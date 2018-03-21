const fs = require('fs')
const tmp = require('tmp')
const unzip = require('unzip')
const parse = require('xml-parser');
const { spawn, createChildProcess } = require('child_process')
const mkdirp = require('mkdirp')
const path = require('path')
const { getLogger } = require(__dirname + '/utils.logger.js')

const logger = getLogger('debug')

const _getFileFromEPub = (ePubPath, filePath) => {
	return new Promise((resolve, reject) => {
		let found = false

		logger.debug(`looking for file ${filePath}`)
		fs.createReadStream(ePubPath)
			.pipe(unzip.Parse())
			.on('entry', function (entry) {
				if (entry.type === 'File'  && entry.path === filePath.split('#')[0]) {
					found = true
					let chp = ''
					entry.on('data', data => {
						chp += data.toString()
					})
					entry.on('end', () => {
                        entry.removeAllListeners()
                        entry.autodrain()
                        resolve(chp)
					})
				} else {
					entry.autodrain()
				}
			})
			.on('close', () => {
				if (!found)
					reject('file not found: ' + filePath)
			})
			.on('error', err => {
				if (!found)
					reject(err)
			})
	})
}

module.exports = {
    createTempDir() {
        return new Promise((resolve, reject) => {
            tmp.dir({ unsafeCleanup: true, prefix: 'current_' }, (err, path) => {
                if (err) {
					reject(err)
				} else {
					logger.debug('created temp folder: ' + path)
                    resolve(path)
				}
            })
        })
    },
    getRootFile(ePubPath) {
    	const _self = this
        return new Promise((resolve, reject) => {
        	_getFileFromEPub(ePubPath, 'META-INF/container.xml')
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
    	const _self = this
		return new Promise((resolve, reject) => {
			logger.debug(`reading rootFile: "${rootFilePath}"`)
			const isChapterSpcifier = child => {
			  const attrs = child.attributes
			  return child.name === 'item' && attrs['media-type'] === 'application/x-dtbncx+xml'
			}

			_getFileFromEPub(ePubPath, rootFilePath)
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
    	const _self = this

		// === Helpers
		const paddingForParts = '  '

		// use to strip and directives like !DOCTYPE from our file before we try to parse it as xml
		const stripDocType = xml => {
			const location = xml.indexOf('<!DOCTYPE')
			if (location < 0)
				return xml

			const endLocation = xml.slice(location).indexOf('>') + location + 1
			return xml.slice(0, location) + xml.slice(endLocation)
		}

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
			_getFileFromEPub(ePubPath, chpLocation)
				.then(contents => {
					// cheep hack, remove doctype because xml parser can't handle this
					const xml = stripDocType(contents)
					const obj = parse(xml);

					if (!obj.root)
						return reject(`failed to parse xml:\n\n ${xml}`)

					const list = extractChapters(obj.root.children.find(node => node.name === 'navMap'))
					resolve(list)
				})
				.catch(reject)
        })
    },
    renderChapter(ePupFilePath, chpPath) {
    	const _self = this;
        return new Promise((resolve, reject) => {
        	// echo "<html><head><title>foo</title></head><body><h3>hello</h3></body></html>" | w3m -T text/html
			_getFileFromEPub(ePupFilePath, chpPath)
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

    unzip(zipFilePath, outPath) {
		return new Promise((resolve, reject) => {
			logger.debug('extracting e-book: ' + zipFilePath)
			let terminatedEarly = false

			fs.createReadStream(zipFilePath).pipe(unzip.Parse())
				.on('entry', (entry) => {
					if (terminatedEarly) {
						// we already rejected the promise, just skip the reset
						return entry.autodrain()
					}

					logger.debug(`examining => path: "${entry.path}" , type: "${entry.type}"`)
					if (entry.type === 'File' && entry.path[entry.path.length - 1] === path.sep) {
						/*
						   Filter to work around issue, some epub files contain a file entry
							   for the META-INF folder specified with the type file, when you use extract
							   from the unzip library it naively creates a file then blows up when it tries to
							   extract files into it
						*/
						const newDir = outPath + '/' + entry.path
						logger.debug(`discovered folder in zip marked file, creating folder instead => "${newDir}"`)
						mkdirp(newDir, err => {
							if (err) {
								terminatedEarly = true
								reject('error creating directory: ' + outPath + entry.path)
							} else {
								logger.debug(`created directory: "${newDir}"`)
							}

							entry.autodrain()
						})
					} else {
						const newFilePath = outPath + '/' + entry.path
						mkdirp(path.dirname(newFilePath), err => {
							if (err) {
								terminatedEarly = true
								entry.autodrain()
								reject('error creating folder: ' + path.dirname(newFilePath))
							} else {
								logger.debug(`try to write => path: "${newFilePath}" , type: "${entry.type}"`)
								entry.pipe(fs.createWriteStream(newFilePath))
							}
						})
					}
				})
				.on('error', err => {
					logger.debug(`error extracting files: "${err}"`)
					terminatedEarly = true
					reject(err)
				})
                .on('close', () => {
                    logger.debug('finished extracting e-book: ' + zipFilePath)

					// include to the outPath we were passed to thread along the promise chain
					resolve(outPath)
                })
		})
    }
}
