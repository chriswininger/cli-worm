const blessed = require('blessed')
const EventEmitter = require('events');

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
                    fg: '#f0f0f0'
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

    createEventHandlers(screen, chapters, content) {
        screen.key(['escape', 'q', 'C-c'], (ch, key) => {
            return process.exit(0);
        });
        screen.key(['tab'], (ch, key) => {
            screen.focusNext();
        });

        chapters.on('select', (event, ndx) => {
            this.emit('chapter-select', this.chaptersList[ndx])
        });

        content.key('down', ()=> {
            content.scroll(1);
            screen.render();
        });
        content.key('up', ()=> {
            content.scroll(-1);
            screen.render();
        });
    }
    setChapters(chaptersList) {
        this.chaptersList = chaptersList
        this.chapters.setItems(chaptersList.map(chp => chp.text))
        this.render()
    }

    setContent(text) {
        this.content.setContent(text)
        this.render()
    }

    render() {
        this.screen.render()
    }
}