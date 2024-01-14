import winston from "winston";

import { ENV } from "../consts.js";

const logLevel = ENV.logLevel ?? "info";

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});
