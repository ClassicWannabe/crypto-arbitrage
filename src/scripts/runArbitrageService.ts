import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";

import { MultiExchangeCalculator } from "../calculators/MultiExchangeCalculator/MultiExchangeCalculator.js";
import { logger } from "../logger/logger.js";
import { getEnv, sleep } from "../helpers.js";
import { FileStorage } from "../storages/File/File.js";
import { Telegram } from "../publishers/Telegram/Telegram.js";
import { MultiExchangeArbitrage } from "../services/MultiExchangeArbitrage/MultiExchangeArbitrage.js";
import { ArbitrageFormatter } from "../formatters/ArbitrageFormatter/ArbitrageFormatter.js";
import { ExchangeFactory } from "../exchanges/ExchangeFactory/ExchangeFactory.js";
import { ExchangeType } from "../exchanges/types.js";

const storage = new FileStorage();
const arbitrageConfig = await storage.getArbitrageConfig();

const exchangeFactory = new ExchangeFactory(arbitrageConfig);

const binance = exchangeFactory.getExchange(ExchangeType.BINANCE);
const okx = exchangeFactory.getExchange(ExchangeType.OKX);
const bybit = exchangeFactory.getExchange(ExchangeType.BYBIT);
const kucoin = exchangeFactory.getExchange(ExchangeType.KUCOIN);
const gateio = exchangeFactory.getExchange(ExchangeType.GATEIO);
const htx = exchangeFactory.getExchange(ExchangeType.HTX);
const mexc = exchangeFactory.getExchange(ExchangeType.MEXC);

const exchanges = [mexc, binance, htx, gateio, okx, bybit, kucoin];

const telegramBotToken = getEnv("telegramBotToken");
const telegramGroupId = getEnv("telegramGroupId");
const telegramDeveloperId = getEnv("telegramDeveloperId");
const bot = new TelegramBot(telegramBotToken);
const publisher = new Telegram(bot, telegramGroupId);

const formatter = new ArbitrageFormatter();
const mutliExchangeCalculator = new MultiExchangeCalculator(exchanges);
const multiExchangeArbitrageService = new MultiExchangeArbitrage(
  mutliExchangeCalculator,
  formatter,
  publisher,
  storage,
  arbitrageConfig.parallelProcessSymbolNumber
);

const main = async () => {
  const fiveMinInSeconds = 5 * 60;
  let iteration = 1;
  while (true) {
    try {
      logger.info(`Start arbitrage service. Iteration: ${iteration}`);
      await multiExchangeArbitrageService.process();
      logger.info("Finish arbitrage service...");
    } catch (e) {
      const error = e as Error;
      console.log(error);

      if (error.stack) {
        await bot.sendMessage(telegramDeveloperId, error.stack);
      }
      await bot.sendMessage(
        telegramGroupId,
        "Arbitrage calculation failed... Stopped for 5 min"
      );
      await sleep(fiveMinInSeconds);
    }

    iteration++;
  }
};

main();
