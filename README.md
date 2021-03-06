cli-worm
------------------

A simple CLI epub reader

![Alt text](docs/images/cli-worm-logo.png?raw=true "logo")

#### Description

* Do you want to read an epub file, but you're too lazy to move your hand from the keyboard to the mouse?

* Do you miss the good old days of reading the encyclopedia via an ncurses application?

* Do you know what an encyclopedia is?

  **Then this app is for you!**

#### Install on Linux with Snaps

`sudo snap install cli-worm`

#### Install with npm (See prerequisites below)
`npm install -g cli-worm`

#### Prerequisites
* w3m
    * [OSX Instructions](http://macappstore.org/w3m/)
    * [Ubuntu](https://www.howtoinstall.co/en/ubuntu/xenial/w3m)
* nodeJS (>= 10.19.0)
    * I recommend first installing [nvm](https://github.com/creationix/nvm/blob/master/README.md) first,
    then simply running, `nvm install node 8.9.4`, but you can also install node directly. Google
    for your platform of choice 


### Usage

`cli-worm [--flags] <filePath>`

This will a ncurses interface.

![Alt text](docs/images/cli-worm-screen-grab.png?raw=true "Screen Capture")

You should see a chapter list on the right and the contents of the selected chapter on the left.

You can switch between chapter selection and contents scrolling with the tab button.

The up and down arrows scroll the content. You can can also use pg-up or pg-down.

**To Exit** press `q`, `escape` or `ctrl+c`

### flags
* `--dumpdumpChapterList`: prints a list of all chapters in the e-pub with each chapter separated by a new line charater and each line containing the chapter title and the path to the chapter within the e-pub separated by commas
* `--dumpFullText`: dumps the entire text of all chapters in the book to the command line

### Debugging

This project uses log4j. To turn on debug logs set the Level to debug on the environment.

Example: `Level=debug node ./index.js ~/Documents/Books\ And\ Papers/Books/polarized.epub`

You can then tail debug.log file to see output 

