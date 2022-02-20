const { createLogger, format, transports} = require('winston');

//Needed for winston to log error objects
//See https://github.com/winstonjs/winston/issues/1338
const enumerateErrorFormat = format(info => {
    if(info.message instanceof Error) {
        info.message = Object.assign({
            message: info.message.message,
            stack: info.message.stack
        }, info.message);
    }

    if(info instanceof Error) {
        return Object.assign({
            message: info.message,
            stack: info.stack
        }, info);
    }

    return info;
});

const logger = createLogger({
    level: "http",
    format: format.combine(
        enumerateErrorFormat(),
        format.timestamp(),
        format.json()
    ),
    transports: [
        new transports.File({filename: "logs/error.log", level: "error"}),
        new transports.File({filename: "logs/info.log", level: "info"}),
        new transports.File({filename: "logs/http.log", level: "http"}),
        new transports.File({filename: "logs/verbose.log", level: "verbose"})
    ]
});

// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console({
      format: format.simple(),
      level: "http"
    }));
}

module.exports = logger;