const { exec } = require('child_process');
const { createTempDir, unzip, getChapters, renderChapter, getNCXFile, getRootFile } = require('./utils/utils')
const UI = require('./ui/ui')

const filePath = process.argv[2];

if (!filePath) {
	console.warn('please specify a file path')
	return process.exit(1)
}


const ui = new UI()
let baseLoc = null
let contentFolder = null

createTempDir()
	.then((tmp) => unzip(filePath, tmp))
	.then((tmpPath) => {
		baseLoc = tmpPath
		return getRootFile(baseLoc + '/META-INF/container.xml')
	})
	.then((mainFileInfo) => {
		contentFolder = mainFileInfo.folder
		return getNCXFile(baseLoc + '/' + mainFileInfo.filePath)
	})
	.then(chpFile => {
		// location is specified relative to the location of the main file (opf) was found
        const chpListLocation = `${baseLoc}/${contentFolder}/${chpFile}`
		return getChapters(chpListLocation)
    }).then(chapterList => {
    	ui.setChapters(chapterList)
	})
	.catch(err => {
		ui.setContent(`error: "${err}"`)
	})

ui.on('chapter-select', (chp) => {
    renderChapter(`${baseLoc}/${contentFolder}/${chp.link}`)
		.then((text) => ui.setContent(text))
		.catch(err => ui.setContent('error: ' + err))
})
