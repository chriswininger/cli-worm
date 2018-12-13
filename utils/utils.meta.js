const sqlite = require('sqlite')
const fs = require('fs')
const logger = require(__dirname + '/utils.logger.js').getLogger('debug')
const path = require('path')

const dbRootFilePath = process.env.SNAP_USER_DATA || __dirname
const dbFilePath = path.join(dbRootFilePath, 'data.sqlite')

module.exports = {
  getDBForMetaContent() {
    const hasSQLDB = () => new Promise((resolve, reject) => {
      fs.stat(dbFilePath, err => {
        if (err && err.code === 'ENOENT') {
          resolve(false)
        } else if (err) {
          reject(err)
        } else {
          resolve(true)
        }
      })
    })

    const createTable = () => new Promise(async (resolve, reject) => {
      try {
        const db = await sqlite.open(dbFilePath, { Promise })
        await db.get(
							`CREATE TABLE current_positions
					(
						book_unique_title_hash TEXT UNIQUE PRIMARY KEY,
						book_title TEXT,
						book_path TEXT,
						chapter_index INTEGER,
						chapter_position TEXT,
						last_updated
					);`)
        logger.debug('created db: ' + db)
        resolve(db)
      } catch (ex) {
        reject(ex)
      }
    })

    return new Promise(async (resolve, reject) => {
      let hasDB = false
      try {
        hasDB = await hasSQLDB()

        if (!hasDB) {
          logger.debug('create the sqlite db')
          fs.closeSync(fs.openSync(dbFilePath, 'w'))
          const db = await createTable()
          resolve(db)
        } else {
          try {
            logger.debug('database file already exists, return connection')
            const db = await sqlite.open(dbFilePath, {Promise})
            resolve(db)
          } catch (ex) {
            reject(ex)
          }
        }
      } catch(ex) {
        reject(ex)
      }
    })
  },

  setCurrentPostion() {

  }
}
