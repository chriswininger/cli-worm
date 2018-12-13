const path = require('path')
const { configure, getLogger } = require('log4js')
require('dotenv').config()

module.exports = {
  getLogger: (level) => {
    const rootLogPath = process.env.SNAP_USER_DATA || __dirname + '/../'
    const logPath = path.join(rootLogPath, 'debug.log')

    level = level || 'debug'
    configure({
      appenders: { debug: { type: 'file', filename: logPath } },
      categories: { default: { appenders: ['debug'], level: 'debug' } }
    })
    const logger = getLogger(level)
    logger.level = process.env.Level || 'OFF'

    return logger
  }
}
