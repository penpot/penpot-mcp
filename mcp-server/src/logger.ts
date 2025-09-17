import pino from "pino";

/**
 * Logger instance configured for console output with metadata.
 *
 * Configured to output to console only with level, full timestamp, origin, and message.
 */
export const logger = pino({
    level: "info",
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
        level: (label) => {
            return { level: label };
        },
    },
    transport: {
        target: "pino-pretty",
        options: {
            colorize: true,
            translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
            ignore: "pid,hostname",
            messageFormat: "{msg}",
            levelFirst: true,
        },
    },
});

/**
 * Creates a child logger with the specified name/origin.
 *
 * @param name - The name/origin identifier for the logger
 * @returns Child logger instance with the specified name
 */
export function createLogger(name: string) {
    return logger.child({ name });
}
