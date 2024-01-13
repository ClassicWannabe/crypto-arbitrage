import { env } from "./consts.js";
import { logger } from "./logger/logger.js";

export const getEnv = (name: keyof typeof env): string => {
  const envVar = env[name];

  if (!envVar) {
    throw new Error(`Could not find env variable: ${name}`);
  }

  return envVar;
};

export const sleep = async (seconds: number) => {
  logger.debug(`Sleeping ${seconds} seconds`);

  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
};
