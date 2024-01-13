import "dotenv/config";
import ccxt from "ccxt";
import fs from "fs";
import TelegramBot from "node-telegram-bot-api";

import { MultiExchangeCalculator } from "./calculators/MultiExchangeCalculator/MultiExchangeCalculator.js";
import { Binance } from "./exchanges/Binance/Binance.js";
import { GateIO } from "./exchanges/GateIO/GateIO.js";
import { HTX } from "./exchanges/HTX/HTX.js";
import { OKX } from "./exchanges/OKX/OKX.js";
import { Bybit } from "./exchanges/Bybit/Bybit.js";
import { Kucoin } from "./exchanges/Kucoin/Kucoin.js";
import { MEXC } from "./exchanges/MEXC/MEXC.js";
import { logger } from "./logger/logger.js";
import { env } from "./consts.js";
import { getEnv, sleep } from "./helpers.js";
import { FileStorage } from "./storages/File/File.js";
import { Telegram } from "./publishers/Telegram/Telegram.js";
import { MultiExchangeArbitrage } from "./services/MultiExchangeArbitrage/MultiExchangeArbitrage.js";
import { ArbitrageFormatter } from "./formatters/ArbitrageFormatter/ArbitrageFormatter.js";

const ccxtBinance = new ccxt.binance({
  apiKey: env.binanceApiKey,
  secret: env.binanceApiSecret,
});
const binance = new Binance(ccxtBinance);

const ccxtOkx = new ccxt.okx({
  apiKey: env.okxApiKey,
  secret: env.okxApiSecret,
});
// const okx = new OKX(ccxtOkx);

const ccxtBybit = new ccxt.bybit({
  apiKey: env.bybitApiKey,
  secret: env.bybitApiSecret,
});
const bybit = new Bybit(ccxtBybit);

const ccxtKucoin = new ccxt.kucoin({
  apiKey: env.kucoinApiKey,
  secret: env.kucoinApiSecret,
});
// const kucoin = new Kucoin(ccxtKucoin);

const ccxtGateio = new ccxt.gateio({
  apiKey: env.gateioApiKey,
  secret: env.gateioApiSecret,
});
const gateio = new GateIO(ccxtGateio);

const ccxtHtx = new ccxt.htx({
  apiKey: env.htxApiKey,
  secret: env.htxApiSecret,
});
const htx = new HTX(ccxtHtx);

const ccxtMexc = new ccxt.mexc({
  apiKey: env.mexcApiKey,
  secret: env.mexcApiSecret,
});
const mexc = new MEXC(ccxtMexc);

const exchanges = [binance, htx, gateio];

const telegramBotToken = getEnv("telegramBotToken");
const telegramGroupId = getEnv("telegramGroupId");
const bot = new TelegramBot(telegramBotToken, {
  polling: true,
});
const publisher = new Telegram(bot, telegramGroupId);

const mutliExchangeCalculator = new MultiExchangeCalculator(exchanges, 0);
const storage = new FileStorage();
const formatter = new ArbitrageFormatter();

const multiExchangeArbitrageService = new MultiExchangeArbitrage(
  mutliExchangeCalculator,
  formatter,
  publisher,
  storage
);

const main = async () => {
  let iteration = 1;
  while (true) {
    console.time(`iteration: ${iteration}`);
    logger.info(`Iteration: ${iteration}`);
    await multiExchangeArbitrageService.process();

    console.timeEnd(`iteration: ${iteration}`);
    await sleep(300);
    iteration++;
  }
};

main();
