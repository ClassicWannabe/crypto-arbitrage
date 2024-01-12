import winston from "winston";

const logLevel = process.env.LOG_LEVEL ?? "info";

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});
