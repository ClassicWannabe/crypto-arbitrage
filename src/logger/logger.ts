import winston from "winston";

import { env } from "../consts.js";

const logLevel = env.logLevel ?? "info";

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});
