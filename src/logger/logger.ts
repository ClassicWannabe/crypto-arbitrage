import winston from "winston";

import { ENV } from "../consts.js";
import { NodeEnv } from "../types.js";

const logLevel = ENV.logLevel ?? "info";
const env = ENV.node;

const transports: winston.transport[] = [
  new winston.transports.File({ filename: "server.log" }),
];

if (env === NodeEnv.DEV) {
  transports.push(new winston.transports.Console());
}

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.json(),
    winston.format.errors({ stack: true })
  ),
  transports,
});
