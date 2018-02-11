const fs = require('fs')
const tmp = require('tmp')
const unzip = require('unzip')
const parse = require('xml-parser');
const { spawn } = require('child_process')
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
                if (err)
                    reject(err)
                else
                    resolve(path)
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

                resolve(filePath)
            })
        })
    },
    getNCXFile(rootFilePath) {
      return new Promise((resolve, reject) => {
          fs.readFile(rootFilePath, 'utf8', (err, xml) => {
              if (err)
                  return reject(err)

              const xmlObj = parse(xml)

              const refObj = xmlObj.root.children
                .find(child => child.name === 'manifest').children
                .find(child => child.name === 'item' && (child.attributes.id === 'ncx' || child.attributes.id === 'toc'))

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

                            //console.log(navPoint)

                            // recur back for any nested chapters
                            list = list.concat(extractChapters(navPoint, padding + paddingForParts))
                        })

                    return list
                }

                // cheep hack, for now
                const str = '<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">'
                xml = xml.replace(str, '')

                const obj = parse(xml);

                const list = extractChapters(obj.root.children.find(node => node.name === 'navMap'))
                logger.debug('root: ' + JSON.stringify(list, null, 4))
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
            fs.createReadStream(zipFilePath).pipe(unzip.Extract({path: outPath}))
                .on('close', (err) => {
                    if(err)
                        reject(err)
                    else
                        resolve(outPath)
                })
        })
    }
}
