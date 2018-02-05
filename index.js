const blessed = require('blessed');
const async = require('async');
const { exec } = require('child_process');
const fs = require('fs');
const parse = require('xml-parser');

const baseLoc = './currentBook/OEBPS/'
const chpLocation = baseLoc + 'toc.ncx'
const chpList = getChapters();

const screen = blessed.screen({
	smartCSR: true
});

screen.key(['escape', 'q', 'C-c'], (ch, key) => {
	return process.exit(0);
});
screen.key(['tab'], (ch, key) => {
	screen.focusNext();
});

screen.title = 'cli-book-worm';

const chapters = blessed.list({
	top: 'center',
	left: 'left',
	width: '20%',
	height: '100%',
	items: chpList.map(chp => chp.text),
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

const content = blessed.box({
	top: 'center',
	left: '20%',
	width: '80%',
	height: '100%',
	content: 'foo',
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

chapters.on('select', (event, ndx) => {
	openChapter(ndx);
});
content.key('down', ()=> {
	content.scroll(1);
	screen.render();
});
content.key('up', ()=> {
	content.scroll(-1);
	screen.render();
});

screen.append(chapters);
screen.append(content);
chapters.focus();
screen.render();

// === helpers
function openChapter(ndx) {
	const chp = chpList[ndx];
	async.waterfall([
		_next => {
			exec('w3m ' + baseLoc + chp.link, (err, stdout, stderr) => {
				if(err)
					return _next(err);
				_next(null, stdout);
			});
		}
	], (err, text) => {
		if (err)
			content.setContent('error: ' + err);
		else
			content.setContent(text);

		screen.render();
	});
}

function getChapters() {
	const xml = fs.readFileSync(chpLocation, 'utf8');
	const obj = parse(xml);
	return obj.root.children.find(node => node.name === 'navMap')
		.children.filter(node => node.name === 'navPoint')
		.map(navPoint => {
      	return {
         	text: navPoint.children.find(p => p.name === 'navLabel').children.find(p => p.name === 'text').content,
         	link: navPoint.children.find(p => p.name === 'content').attributes.src 
      	}
  	 	});
}
