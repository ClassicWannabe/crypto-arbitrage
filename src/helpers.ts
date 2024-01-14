import ccxt from "ccxt";

import { ENV } from "./consts.js";
import { logger } from "./logger/logger.js";
import { RateLimits } from "./storages/types.js";

export const getEnv = (name: keyof typeof ENV): string => {
  const envVar = ENV[name];

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

export const getExchangeDefaultRateLimits = (): Required<RateLimits> => {
  return {
    binance: new ccxt.binance().rateLimit,
    bybit: new ccxt.bybit().rateLimit,
    gateio: new ccxt.gateio().rateLimit,
    htx: new ccxt.htx().rateLimit,
    kucoin: new ccxt.kucoin().rateLimit,
    mexc: new ccxt.mexc().rateLimit,
    okx: new ccxt.okx().rateLimit,
  };
};
