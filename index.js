#!/usr/bin/env node

const fs = require('fs')
const { createTempDir, unzip, getChapters, renderChapter, getNCXFile, getRootFile } = require('./utils/utils')
const argumentParser = require('./utils/argumentParser')
const async = require('async')
const UI = require('./ui/ui')

const { filePath, flags } = argumentParser(process.argv)

if (!filePath) {
	console.warn('please specify a file path')
	return process.exit(1)
}

let baseLoc = null
let contentFolder = null

createTempDir()
	.then((tmp) => unzip(filePath, tmp))
	.then((tmpPath) => {
		baseLoc = tmpPath
		return getRootFile(filePath)
	})
	.then((mainFileInfo) => {
		contentFolder = mainFileInfo.folder
		return getNCXFile(filePath, mainFileInfo.filePath)
	})
	.then(chpFile => {
		// location is specified relative to the location of the main file (opf) was found
		return getChapters(filePath, `${contentFolder}/${chpFile}`)
    }).then(chapterList => {
    	if (flags.dumpChapterList) {
			chapterList.forEach(chp => console.log(`"${chp.text}", "${chp.link}"`))
			process.exit(0)
		} else if (flags.dumpFullText) {
    		async.eachSeries(chapterList, (chp, _nextChp) => {
    			if (chp.link.indexOf('#') > 0)
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
			renderUI(null, chapterList)
		}
	})
	.catch(err => {
		console.error(err)
		process.exit(1)
	})

function renderUI(err, chapterList) {
	const ui = new UI()

	if (err)
		return ui.setContent(`error: "${err}"`)

	ui.setChapters(chapterList)
	ui.on('chapter-select', (chp) => {
		/*
			TODO (CAW): Currently we are doing some gymnastics to re-export the zip file into
				a new temp if the old one expires, at some point we should avoid this issue all together
				by either:
					1. reading from the zip directly without exporting
					2. reading all contents into memory immediately after we unzip it
					3. using a directory in our application folder that we control and just clearing it each time we open
		 */
		_openChapter(chp, 0)

		function _openChapter(chp, tries) {
			renderChapter(filePath, `${contentFolder}/${chp.link}`)
				.then((text) => {
					ui.setContent(text)
					ui.content.focus()
				})
				.catch(baseErr => {
					if (tries > 0) {
						// we already tried to fix this once, just show the error
						return ui.setContent(`error rendering chapter: ${baseErr}`)
					}

					// see if this was because our temp dir got removed
					fs.stat(baseLoc, err => {
						if (err && err.code === 'ENOENT') {
							/*
								looks like our base folder no longer exists, it was a temp dir, perhaps it expired,
									let's make it again
							 */
							createTempDir()
								.then(tmp => unzip(filePath, tmp))
								.then((tmpPath) => baseLoc = tmpPath)
								.then(() => _openChapter(chp, ++tries))
								.catch(err => {
									// if even that didn't work give up
									ui.setContent(`error creating new temp dir: ${err}`)
								})
						} else {
							// give up and just show the error in the content box
							ui.setContent(`error rendering chapter: ${baseErr}`)
						}
					})
				})
		}
	})
}
