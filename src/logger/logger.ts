import winston from "winston";

import { ENV } from "../consts.js";
import { NODE_ENV } from "../types.js";

const logLevel = ENV.logLevel ?? "info";
const env = ENV.node;

const transports: winston.transport[] = [
  new winston.transports.File({ filename: "server.log" }),
];

if (env === NODE_ENV.DEV) {
  transports.push(new winston.transports.Console());
}

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.json(),
  transports,
});
