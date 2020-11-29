const blessed = require('blessed')
const EventEmitter = require('events')
const crypto = require('crypto')
const path = require('path')
const { renderChapter } = require(__dirname + '/../utils/utils.js')
const logger = require(__dirname + '/../utils/utils.logger.js').getLogger('debug')

const SELECTED_BORDER_COLOR = '#008000'
const UNSELECTED_BORDER_COLOR = '#f0f0f0'
const SCROLL_BAR_COLOR = SELECTED_BORDER_COLOR

module.exports = class UI extends EventEmitter {
  constructor(title, filePath, chapterList, contentFolder, db) {
    super()

    this.title = title
    this.screen = this.createScreenDisplay()
    this.fileName = path.basename(filePath)

    // a hash generated as a combo of the file name and title extracted from file to serve as a unique marker
    this.uniqueTitleHash = crypto.createHash('md5').update(title + filePath).digest("hex")

    this.chapters = this.createChaptersDisplay()
    this.content = this.createContentDisplay()

    this.filePath = filePath
    this.contentFolder = contentFolder
    this.db = db
    this.createEventHandlers(this.screen, this.chapters, this.content)

    this.screen.append(this.chapters)
    this.screen.append(this.content)

    this.setChapters(chapterList)

    this.chapters.focus()
    this.render()

    logger.debug('check for existing last positions')
    this.getCurrentChapter()
        .then(pos => {
          if (pos) {
            logger.debug('selecting chapter based on last reading session: ' + pos.chapter_index)
            this.setSelectedChapter(pos.chapter_index)
            this.render()
          }
        })
        .catch(ex => logger.debug('error getting last reading position: ' + ex))
  }

  createScreenDisplay() {
    const screen = blessed.screen({
      smartCSR: true
    })

    screen.title = 'cli-book-worm -- ' + this.title

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
        bg: 'black',
        selectedBorderColor: SELECTED_BORDER_COLOR,
        border: {
          bg: 'black',
          fg: UNSELECTED_BORDER_COLOR
        },
        selected: {
          fg: SELECTED_BORDER_COLOR,
          bg: 'black',
          bold: true
        }
      }
    })

    return chapters
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
      scrollbar: {
          bg: 'green'
      },
      keyable: true,
      clickable: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'black',
        selectedBorderColor: SCROLL_BAR_COLOR,
        border: {
          bg: 'black',
          fg: UNSELECTED_BORDER_COLOR
        },
      }
    })

    // don't try to parse unix escape characters and such -- fix for setting text to {X,YY,ZZZ}
    content.parseTags = false
    return content
  }

  setSelectedChapter(ndx) {
    if (ndx >= this.chaptersList.length || ndx < 0)
      return logger.debug('preventing chapter from being set to a value outside of bounds')

    this.chapterNDX = ndx
    this.chapters.select(ndx)

    return this.renderSelectedChapter()
  }

  renderSelectedChapter() {
    const chp = this.chaptersList[this.chapterNDX]

    return renderChapter(this.filePath, `${this.contentFolder}/${chp.link}`)
      .then(text => {
        logger.debug('in render chapter promise handler')
        this.setContent(text)
        this.content.focus()
        this.updateCurrentChapter()
      })
      .catch(err => {
        this.setContent(`error rendering chapter: ${err}`)
        logger.debug(`error rendering chapter: "${err}"`)
        logger.error(err)
      })
  }

  incrementChapter() {
    if (this.chapterNDX < this.chaptersList.length - 1) {
      // advance chapter selection
      if (this.chaptersList[this.chapterNDX + 1].isSubChapter) {
        // this appears to be a sub-chapter referring to position within same file, skip it
        this.chapterNDX++
        return this.incrementChapter()
      }

      this.setSelectedChapter(this.chapterNDX + 1)
    }
  }

  async decrementChapter() {
    if (this.chapterNDX > 0) {
      // advance chapter selection
      if (this.chaptersList[this.chapterNDX - 1].isSubChapter) {
        // this appears to be a sub-chapter referring to position within same file, skip it
        this.chapterNDX--
        return this.decrementChapter()
      }

      await this.setSelectedChapter(this.chapterNDX - 1)
      this.scrollToEndOfChapter()
    }
  }

  scrollToEndOfChapter() {
    logger.debug('scrolling to the top of the chapter')
    this.content.setScrollPerc(100)
    this.render()
  }

  createEventHandlers(screen, chapters, content) {
    const isAtBottom = () => {
      return this.content.getScrollPerc() >= 100 || this.content.height > this.content.getScrollHeight()
    }
    const isAtTop = () => {
      return this.content.getScrollPerc() <= 0 || this.content.height > this.content.getScrollHeight()
    }

    // exit the application
    screen.key(['escape', 'Q', 'q', 'C-c'], () => {
      this.emit('close')
    })

    // switching between chapter selection and content
    screen.key(['tab'], () => {
      screen.focusNext()
    })

    // chapter selection
    chapters.on('select', (event, ndx) => {
      this.setSelectedChapter(ndx)
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
        content.scroll(1)
        screen.render()
      } else  {
        // advance chapter selection
        this.incrementChapter()
      }
    })
    content.key('up', ()=> {
      if (!isAtTop()) {
        content.scroll(-1)
        screen.render()
      } else {
        // go back one chapter
        this.decrementChapter()
      }
    })

    // === updating appearance based on active focus content/chapters
    content.on('focus', () => {
      content.style.border.fg = SELECTED_BORDER_COLOR
      this.render()
    })
    chapters.on('focus', () => {
      chapters.style.border.fg = SELECTED_BORDER_COLOR
      this.render()
    })
    content.on('blur', () => {
      content.style.border.fg = UNSELECTED_BORDER_COLOR
      this.render()
    })
    chapters.on('blur', () => {
      chapters.style.border.fg = UNSELECTED_BORDER_COLOR
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

  getCurrentChapter() {
    return new Promise(async (resolve, reject) => {
      try {
        const results = await this.db.get(`
    				SELECT * FROM current_positions
    				WHERE book_unique_title_hash = '${this.uniqueTitleHash}'
    			`)
        resolve(results)
      } catch (ex) {
        reject(ex)
      }
    })
  }
  updateCurrentChapter() {
    this.db.get(`
			REPLACE INTO current_positions
				(book_unique_title_hash, book_title, book_path, chapter_index, chapter_position, last_updated)
				VALUES
				('${this.uniqueTitleHash}', '${this.title}', '${ this.filePath }', '${this.chapterNDX}', null, ${Date.now()})
		`).catch(err => this.setContent(`error updating position: ${err}`))
  }
}