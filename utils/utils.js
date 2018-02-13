const fs = require('fs')
const tmp = require('tmp')
const unzip = require('unzip')
const parse = require('xml-parser');
const { spawn } = require('child_process')
const mkdirp = require('mkdirp')
const path = require('path')
const { configure, getLogger } = require('log4js');

configure({
    appenders: { debug: { type: 'file', filename: 'debug.log' } },
    categories: { default: { appenders: ['debug'], level: 'debug' } }
});
const logger = getLogger('debug');
logger.level = 'debug';

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
    getRootFile(metaFile) {
        return new Promise((resolve, reject) => {
            fs.readFile(metaFile, 'utf8', (err, xml) => {
                if (err)
                    return reject(err)

                const xmlObj = parse(xml)
                const filePath = xmlObj.root.children
                    .find(child => child.name === 'rootfiles').children
                    .find(child => child.name === 'rootfile').attributes['full-path']

                const folder = filePath.split(path.sep)[filePath.split(path.sep).length - 2] || ''
                logger.debug('resolved root file location (.opf): ' + filePath)
                logger.debug('resolved root folder name: ' + folder)

                resolve({ folder, filePath })
            })
        })
    },
    getNCXFile(rootFilePath) {
      return new Promise((resolve, reject) => {
          logger.debug(`reading rootFile: "${rootFilePath}"`)
          fs.readFile(rootFilePath, 'utf8', (err, xml) => {
              if (err)
                  return reject(err)

              const isChapterSpcifier = child => {
                  const attrs = child.attributes
                  return child.name === 'item' && attrs['media-type'] === 'application/x-dtbncx+xml'
                  /*return child.name === 'item' &&
                      (attrs.id === 'ncx' || attrs.id === 'toc' || attrs.id === 'ncxtoc')*/
              }

              const xmlObj = parse(xml)

              const manifestObj = xmlObj.root.children.find(child => child.name === 'manifest').children
              const refObj = manifestObj.find(isChapterSpcifier)

              if (!refObj)
				  return logger.debug('missing refObj: ' + JSON.stringify(manifestObj, null, 4))

              const ref = refObj.attributes.href
              resolve(ref)
          })
      })
    },
    getChapters(chpLocation) {
        return new Promise((resolve, reject) => {
            fs.readFile(chpLocation, 'utf8', (err, xml) => {
                if (err)
                    return reject(err)

				const paddingForParts = '  '

                // === Helpers

                // use to strip and directives like !DOCTYPE from our file before we try to parse it as xml
                const stripDocType = xml => {
					const location = xml.indexOf('<!DOCTYPE')
					if (location < 0)
						return xml

					const endLocation = xml.slice(location).indexOf('>') + location + 1
					return xml.slice(0, location) + xml.slice(endLocation)
				}

                const extractChapters = (root, padding) => {
                    if (typeof padding === 'undefined')
                        padding = ''

                    let list = []

                    root.children.filter(node => node.name === 'navPoint')
                        .forEach(navPoint => {
                            const linkBlock = navPoint.children.find(p => p.name === 'content')
                            list.push({
                                text: padding + navPoint.children.find(p => p.name === 'navLabel').children.find(p => p.name === 'text').content,
                                link: linkBlock.attributes.src
                            })
                            // recur back for any nested chapters
                            list = list.concat(extractChapters(navPoint, padding + paddingForParts))
                        })

                    return list
                }
                // ====
                // cheep hack, for now
                //const str = '<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">'
                //xml = xml.replace(str, '')
                xml = stripDocType(xml)
                const obj = parse(xml);

                if (!obj.root) {
                    logger.debug(`failed to parse xml:\n\n ${xml}`)
                    return process.exit(1)
                }

                const list = extractChapters(obj.root.children.find(node => node.name === 'navMap'))
                resolve(list)
            })
        })
    },
    renderChapter(chpPath) {
        const cmd = 'w3m'
        return new Promise((resolve, reject) => {
            let results = ''
            const errors = []

            logger.debug(`executing w3m command: "${cmd} ${chpPath}"`)
            const child = spawn(cmd, [chpPath])

            child.stdout.on('data', data => {
                results += data
            })

            child.stderr.on('data', err => {
                errors.push('' + err)
            })

            child.on('close', code => {
                if (code !== 0 || errors.length > 0) {
                    logger.debug('w3m completed with error code: ' + code + ', and errors:\n\n' + errors.join('\n'))
                    reject('w3m closed with error:\n\n' + errors.join('\n'))
                } else {
                    resolve(results)
                }
            })
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
