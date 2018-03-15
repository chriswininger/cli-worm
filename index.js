#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs')
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
		renderChapter(`${baseLoc}/${contentFolder}/${chp.link}`)
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
