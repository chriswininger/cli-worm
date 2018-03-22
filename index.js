#!/usr/bin/env node

const { getLogger } = require(__dirname + '/utils/utils.logger.js')
const { getChapters, renderChapter, getNCXFile, getRootFile } = require('./utils/utils')
const argumentParser = require('./utils/argumentParser')
const async = require('async')
const UI = require('./ui/ui')

const logger = getLogger('debug')
const { filePath, flags } = argumentParser(process.argv)

if (!filePath) {
	console.warn('please specify a file path')
	return process.exit(1)
}

let contentFolder = null

getRootFile(filePath)
	.then((mainFileInfo) => {
		contentFolder = mainFileInfo.folder
		return getNCXFile(filePath, mainFileInfo.filePath)
	})
	.then(chpFile => {
		// location is specified relative to the location of the main file (opf) was found
		return getChapters(filePath, `${contentFolder}/${chpFile}`)
    }).then(chapterList => {
    	logger.debug(`chapters: ${JSON.stringify(chapterList, null, 4)}`)

    	if (flags.dumpChapterList) {
			chapterList.forEach(chp => console.log(`"${chp.text}", "${chp.link}"`))
			process.exit(0)
		} else if (flags.dumpFullText) {
    		async.eachSeries(chapterList, (chp, _nextChp) => {
    			if (chp.isSubChapter())
    				return _nextChp() // skip sub-chapters

				renderChapter(filePath, `${contentFolder}/${chp.link}`)
					.then(text => {
						console.log(`=== ${chp.text} ===\n\n${text}`)
						_nextChp()
					})
					.catch(err => {
						_nextChp(err)
					})
			}, err => {
    			if (err) {
    				console.error(err)
					process.exit(1)
				} else {
    				process.exit(0)
				}
			})
		} else {
			renderUI(chapterList)
		}
	})
	.catch(err => {
		console.error(err)
		process.exit(1)
	})

function renderUI(chapterList) {
	const ui = new UI()
	ui.setChapters(chapterList)
	ui.on('chapter-select', (chp) => {
		renderChapter(filePath, `${contentFolder}/${chp.link}`)
			.then(text => {
				ui.setContent(text)
				ui.content.focus()
			})
			.catch(err => ui.setContent(`error rendering chapter: ${err}`))
	})
}
