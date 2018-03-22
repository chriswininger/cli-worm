const async = require('async')
const { renderChapter } = require(__dirname + '/../utils/utils')

// returns true if we handled a command
module.exports = (flags, filePath, chapterList, contentFolder, complete) => {
	if (flags.dumpChapterList) {
		chapterList.forEach(chp => console.log(`"${chp.text}", "${chp.link}"`))

		// handled the command
		complete(null, true)
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
			if (err)
				return complete(err)

			// handled the command
			complete(null, true)
		})
	} else {
		// nothing to do here
		complete()
	}
}