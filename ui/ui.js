const blessed = require('blessed')
const EventEmitter = require('events');
const { getLogger } = require(__dirname + '/../utils/utils.logger.js')

const logger = getLogger('debug')
const selectedBorderColor = '#008000'
const unSelectedBorderColor = '#f0f0f0'

module.exports = class UI extends EventEmitter {
    constructor() {
        super()
        this.screen = this.createScreenDisplay()
        this.chapters = this.createChaptersDisplay()
        this.content = this.createContentDisplay()
        this.createEventHandlers(this.screen, this.chapters, this.content);
        this.screen.append(this.chapters);
        this.screen.append(this.content);
        this.chapters.focus();
        this.render()
    }

    createScreenDisplay() {
        const screen = blessed.screen({
            smartCSR: true
        });

        screen.title = 'cli-book-worm'

        return screen
    }

    createChaptersDisplay() {
        const chapters = blessed.list({
            top: 'center',
            left: 'left',
            width: '20%',
            height: '100%',
            items: [],
            mouse: true,
            keys: ['down', 'up'],
            tags: true,
            border: {
                type: 'line'
            },
            style: {
                fg: 'white',
                border: {
                    fg: unSelectedBorderColor
                }
            }
        });

        return chapters;
    }

    createContentDisplay() {
        const content = blessed.box({
            top: 'center',
            left: '20%',
            width: '80%',
            height: '100%',
            content: '',
            tags: true,
            mouse: true,
            scrollable: true,
            alwaysScroll: true,
            keyable: true,
            clickable: true,
            scrollbar: {
                bg: 'white'
            },
            border: {
                type: 'line'
            },
            style: {
                fg: 'white',
                border: {
                    fg: '#f0f0f0'
                }
            }
        });

        return content
    }

    incrementChapter() {
		if (this.chapterNDX < this.chaptersList.length - 1) {
			// advance chapter selection
			this.chapterNDX++
			if (this.chaptersList[this.chapterNDX].isSubChapter) {
				// this appears to be a sub-chapter referring to position within same file, skip it
				return this.incrementChapter()
			}

			this.chapters.select(this.chapterNDX)
			this.emit('chapter-select', this.chaptersList[this.chapterNDX])
		}
    }

	decrementChapter() {
		if (this.chapterNDX > 0) {
			// advance chapter selection
			this.chapterNDX--
			if (this.chaptersList[this.chapterNDX].isSubChapter) {
				// this appears to be a sub-chapter referring to position within same file, skip it
				return this.decrementChapter()
			}
			this.chapters.select(this.chapterNDX)
			this.emit('chapter-select', this.chaptersList[this.chapterNDX])
		}
	}

    createEventHandlers(screen, chapters, content) {
        const isAtBottom = () => {
            return this.content.getScrollPerc() >= 100 || this.content.height > this.content.getScrollHeight()
		}
        const isAtTop = () => {
            return this.content.getScrollPerc() <= 0 || this.content.height > this.content.getScrollHeight()
		}

        // exit the application
        screen.key(['escape', 'q', 'C-c'], () => {
            return process.exit(0);
        });

        // switching between chapter selection and content
        screen.key(['tab'], () => {
            screen.focusNext();
        });

        // chapter selection
        chapters.on('select', (event, ndx) => {
            this.chapterNDX = ndx
            this.emit('chapter-select', this.chaptersList[this.chapterNDX])
        })

        // === content scrolling ===
		screen.key(['pagedown'], () => {
			if (!isAtBottom()) {
				content.scroll(this.content.height - 2)
				this.render()
			} else {
			    this.incrementChapter()
            }
		})
		screen.key(['pageup'], () => {
			if (!isAtTop()) {
				content.scroll(0 - this.content.height - 2)
				this.render()
			} else {
			    this.decrementChapter()
            }
		})
        content.key('down', ()=> {
            if (!isAtBottom()) {
				content.scroll(1);
				screen.render();
			} else  {
                // advance chapter selection
               this.incrementChapter()
            }
        })
        content.key('up', ()=> {
            if (!isAtTop()) {
				content.scroll(-1);
				screen.render();
			} else {
                // go back one chapter
                this.decrementChapter()
            }
        })

        // === updating appearance based on active focus content/chapters
        content.on('focus', () => {
            content.style.border.fg = selectedBorderColor
            this.render()
        })
        chapters.on('focus', () => {
            chapters.style.border.fg = selectedBorderColor
            this.render()
        })
        content.on('blur', () => {
            content.style.border.fg = unSelectedBorderColor
            this.render()
        })
        chapters.on('blur', () => {
            chapters.style.border.fg = unSelectedBorderColor
            this.render()
        })
    }
    setChapters(chaptersList) {
        this.chaptersList = chaptersList
        this.chapters.setItems(chaptersList.map(chp => chp.text))
        this.render()
    }

    setContent(text) {
        this.content.setContent(text)
        this.content.resetScroll()
        this.render()
    }

    render() {
        this.screen.render()
    }
}