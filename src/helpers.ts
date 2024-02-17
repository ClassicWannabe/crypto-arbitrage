import ccxt from "ccxt";

import { ENV, ENV_NAMES } from "./consts.js";
import { logger } from "./logger/logger.js";
import { RateLimits } from "./storages/types.js";

export const getEnv = (name: keyof typeof ENV): string => {
  const envVar = ENV[name] ?? process.env[ENV_NAMES[name]];

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
    bitget: new ccxt.bitget().rateLimit,
  };
};

export const populateObject = (
  keys: string[],
  value: unknown,
  object: Record<string, unknown> = {}
): Record<string, unknown> => {
  if (keys.length === 0) {
    return object;
  }
  if (keys.length === 1 && keys[0]) {
    object[keys[0]] = value;
    return object;
  }
  const [key, ...otherKeys] = keys;
  if (!key) {
    return object;
  }
  object[key] = populateObject(otherKeys, value);
  return object;
};
