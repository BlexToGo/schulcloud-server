const winston = require('winston');

const { format, transports, createLogger } = winston;
const { LOG_LEVEL, NODE_ENV } = require('../../config/globals');

let logLevel = LOG_LEVEL;

if (!logLevel) {
	switch (NODE_ENV) {
		case 'default':
			logLevel = 'debug';
			break;
		case 'test':
			logLevel = 'emerg';
			break;
		case 'production':
		default:
			logLevel = 'error';
	}
}

const addType = format.printf((log) => {
	if (log.stack || log.level === 'error') {
		log.type = 'error';
	} else {
		log.type = 'log';
	}
	return log;
});

const colorize = NODE_ENV !== 'production';
let formater;
if (NODE_ENV === 'test') {
	formater = format.combine(
		format.prettyPrint({ depth: 1, colorize }),
	);
} else {
	formater = format.combine(
		format.errors({ stack: true }),
		format.timestamp(),
		addType,
		format.prettyPrint({ depth: 3, colorize }),
	);
}

const logger = createLogger({
	levels: winston.config.syslog.levels,
	level: logLevel,
	format: formater,
	transports: [
		new transports.Console({
			level: logLevel,
			handleExceptions: true,
		}),
	],
	exitOnError: false,
});


module.exports = logger;
