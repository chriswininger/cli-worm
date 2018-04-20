## cli-worm

A simple CLI epub reader

#### Description

* Do you want to read an epub file, but you're too lazy to move your hand from the keyboard to the mouse?

* Do you miss the good old days of reading the encyclopedia via an ncurses application?

* Do you know what an encyclopedia is?

  **Then this app is for you!**

![Alt text](docs/images/cli-worm-screen-grab.png?raw=true "Screen Capture")

#### Prerequisites
* w3m
    * [OSX Instructions](http://macappstore.org/w3m/)
    * [Ubuntu](https://www.howtoinstall.co/en/ubuntu/xenial/w3m)
* nodeJS (>= 6.9.2)
    * I recommend first installing [nvm](https://github.com/creationix/nvm/blob/master/README.md) first,
    then simply running, `nvm install node 8.9.4`, but you can also install node directly. Google
    for your platform of choice 

#### Installation Instructions
`npm install -g cli-worm`

### Usage

`cli-worm [--flags] <filePath>`

### flags
* `--dumpdumpChapterList`: prints a list of all chapters in the e-pub with each chapter separated by a new line charater and each line containing the chapter title and the path to the chapter within the e-pub separated by commas
* `--dumpFullText`: dumps the entire text of all chapters in the book to the command line


