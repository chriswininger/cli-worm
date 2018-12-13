const {version} = require(__dirname + '/../package.json')

const info = [
  `cli-worm ${version}, a simple ncurses e-pub reader.`,
  'Usage: cli-worm [OPTION]... [epub file]...',
  '',
  'Standard Mode:',
  '',
  'When used without any flags this application will display the specified epub file in an ncurses interface.',
  '',
  'Commands:',
  '',
  'esc, q:              quit the application',
  '<arrow up>:          scroll up in the chapter list or selected chapter display',
  '<arrow down>:        scroll down in the chapter list or selected chapter display',
  'tab:                 toggle selection state between the chapter list and the selected chapter display',
  'enter:               opens a chapter when in the chapter list',
  '',
  'Flags:',
  '',
  '--dumpChapterList:   dump the chapter list to standard out',
  '--dumpFullText:      dump the complete contents of the book to standard out',
  "--version, -v:       display the version you are using. What you don't know already?!",
  '--help, -h"          keep calm and don\'t panic',
].join('\n')

module.exports = function showHelp() {
  console.log(info)
}
