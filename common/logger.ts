import winston from "winston";
import { consoleFormat } from "winston-console-format";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.ms(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
  ),
  transports: [
    //
    // - Write all logs with importance level of `error` or less to `error.log`
    // - Write all logs with importance level of `info` or less to `combined.log`
    //
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

const coloredJSON = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.padLevels(),
  consoleFormat({
    showMeta: true,
    metaStrip: ["timestamp", "service"],
    inspectOptions: {
      depth: 3,
      colors: true,
      maxArrayLength: 10,
      maxStringLength: 300,
      breakLength: 120,
      compact: 10,
      sorted: true,
    },
  }),
);

logger.add(
  new winston.transports.Console({
    format: coloredJSON,
  }),
);

export default logger;
