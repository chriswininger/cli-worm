const fs = require('fs')
const tmp = require('tmp')
const unzip = require('unzip')
const parse = require('xml-parser');
const { exec } = require('child_process')

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
                            list.push({
                                text: padding + navPoint.children.find(p => p.name === 'navLabel').children.find(p => p.name === 'text').content,
                                link: navPoint.children.find(p => p.name === 'content').attributes.src
                            })

                            //console.log(navPoint)

                            // recur back for any nested chapters
                            list = list.concat(extractChapters(navPoint, padding + paddingForParts))
                        })

                    return list
                }

                const obj = parse(xml);
                const list = extractChapters(obj.root.children.find(node => node.name === 'navMap'))
                resolve(list)
            })
        })
    },
    renderChapter(chpPath) {
        const cmd = `w3m ${chpPath}`
        return new Promise((resolve, reject) => {
            exec(cmd, (err, stdout) => {
                if (err)
                    return reject(err)

                resolve(stdout)
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
