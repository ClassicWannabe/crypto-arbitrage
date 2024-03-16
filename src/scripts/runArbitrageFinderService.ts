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
import { ArbitrageRepo } from "../storages/ArbitrageRepo/ArbitrageRepo.js";
import { ArbitrageStepsCalculator } from "../calculators/ArbitrageStepsCalculator/ArbitrageStepsCalculator.js";
import { FeeCalculator } from "../calculators/FeeCalculator/FeeCalculator.js";

const storage = new FileStorage();
const arbitrageConfig = await storage.getArbitrageConfig();

const exchangeFactory = new ExchangeFactory(arbitrageConfig);

const exchanges = exchangeFactory.getAllExchanges();

const telegramBotToken = getEnv("telegramBotToken");
const telegramGroupId = getEnv("telegramGroupId");
const telegramDeveloperId = getEnv("telegramDeveloperId");
const bot = new TelegramBot(telegramBotToken);
const publisher = new TelegramPublisher(bot, telegramGroupId);

const formatter = new ArbitrageFormatter();
const feeCalculator = new FeeCalculator();
const arbitrageStepsCalculator = new ArbitrageStepsCalculator(
  feeCalculator,
  arbitrageConfig.minProfitPercent
);
const mutliExchangeCalculator = new MultiExchangeCalculator(
  exchanges,
  arbitrageConfig.targetCoins,
  arbitrageStepsCalculator
);
const arbitrageRepo = new ArbitrageRepo();
const multiExchangeArbitrageService = new MultiExchangeArbitrageFinder(
  mutliExchangeCalculator,
  formatter,
  publisher,
  arbitrageRepo,
  storage,
  arbitrageConfig.parallelProcessSymbolNumber,
  arbitrageConfig.ignoredSymbols
);

const main = async () => {
  await processTask();
};

const processTask = async () => {
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
