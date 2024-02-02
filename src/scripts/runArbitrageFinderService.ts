import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { shuffle } from "lodash-es";

import { MultiExchangeCalculator } from "../calculators/MultiExchangeCalculator/MultiExchangeCalculator.js";
import { logger } from "../logger/logger.js";
import { getEnv, sleep } from "../helpers.js";
import { FileStorage } from "../storages/File/File.js";
import { TelegramPublisher } from "../publishers/TelegramPublisher/TelegramPublisher.js";
import { MultiExchangeArbitrageFinder } from "../services/MultiExchangeArbitrageFinder/MultiExchangeArbitrageFinder.js";
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
const publisher = new TelegramPublisher(bot, telegramGroupId);

const formatter = new ArbitrageFormatter();
const mutliExchangeCalculator = new MultiExchangeCalculator(
  exchanges,
  arbitrageConfig.minProfitPercent,
  arbitrageConfig.targetCoins
);
const multiExchangeArbitrageService = new MultiExchangeArbitrageFinder(
  mutliExchangeCalculator,
  formatter,
  publisher,
  storage,
  arbitrageConfig.parallelProcessSymbolNumber,
  arbitrageConfig.ignoredSymbols
);

const main = async () => {
  await process();
};

const process = async () => {
  const fiveMinInSeconds = 5 * 60;
  let iteration = 1;
  while (true) {
    try {
      logger.info(`Start arbitrage service. Iteration: ${iteration}`);
      await updateSymbols();
      await multiExchangeArbitrageService.process();
      logger.info("Finish arbitrage service...");

      iteration++;
    } catch (e) {
      const error = e as Error;
      logger.error(error.stack);

      if (error.stack) {
        await bot.sendMessage(telegramDeveloperId, error.stack);
      }
      await bot.sendMessage(
        telegramGroupId,
        "Arbitrage calculation failed... Stopped for 5 min"
      );
      await sleep(fiveMinInSeconds);
    }
  }
};

const updateSymbols = async () => {
  try {
    const markets = await Promise.all(
      exchanges.map((exchange) => exchange.getMarkets())
    );

    const symbols = new Set<string>();
    for (const market of markets) {
      const marketSymbols = Object.keys(market);

      for (const marketSymbol of marketSymbols) {
        symbols.add(marketSymbol);
      }
    }

    const shuffledSymbols = shuffle([...symbols]);

    await storage.saveSymbols(shuffledSymbols);
  } catch (e) {
    const error = e as Error;
    logger.error(error.stack);

    if (error.stack) {
      await bot.sendMessage(telegramDeveloperId, error.stack);
    }
    await bot.sendMessage(telegramGroupId, "Could not update symbols");
  }
};

await main();
