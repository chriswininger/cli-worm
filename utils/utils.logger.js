const { configure, getLogger } = require('log4js');
require('dotenv').config()

module.exports = {
    getLogger: (level) => {
        level = level || 'debug'
        configure({
            appenders: { debug: { type: 'file', filename: 'debug.log' } },
            categories: { default: { appenders: ['debug'], level: 'debug' } }
        });
        const logger = getLogger(level);
        logger.level = process.env.Level || 'OFF';

        return logger
    }
}
