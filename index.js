#!/usr/bin/env node

const { getLogger } = require(__dirname + '/utils/utils.logger.js')
const { getChapters, renderChapter, getNCXFile, getRootFile } = require('./utils/utils')
const runCliCommands = require('./ui/runCliCommands')
const argumentParser = require('./utils/argumentParser')
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

		runCliCommands(flags, filePath, chapterList, contentFolder, (err, handled) => {
			if (err) {
				console.error(err)
				process.exit(1)
			} else if (handled) {
				process.exit(0)
			} else {
				const ui = new UI(filePath, chapterList, contentFolder)
				ui.on('close', () => process.exit(0))
			}
		})
	})
	.catch(err => {
		console.error(err)
		process.exit(1)
	})
