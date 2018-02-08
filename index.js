const { exec } = require('child_process');
const { createTempDir, unzip, getChapters, renderChapter } = require('./utils/utils')
const UI = require('./ui/ui')

const filePath = process.argv[2];

if (!filePath) {
	console.warn('please specify a file path')
	return process.exit(1)
}


const ui = new UI()
let baseLoc = null

createTempDir()
	.then((tmp) => unzip(filePath, tmp))
	.then((tmpPath) => {
		baseLoc = tmpPath + '/OEBPS/'
        const chpListLocation = baseLoc + 'toc.ncx'
		return getChapters(chpListLocation)
    }).then(chapterList => {
    	ui.setChapters(chapterList)
	})

ui.on('chapter-select', (chp) => {
    renderChapter(baseLoc + chp.link)
		.then((text) => ui.setContent(text))
		.catch(err => ui.setContent('error: ' + err))
})
