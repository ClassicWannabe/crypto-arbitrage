import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { Monitor } from "forever-monitor";

import { getEnv, getExchangeDefaultRateLimits } from "./helpers.js";
import { logger } from "./logger/logger.js";
import { FileStorage } from "./storages/File/File.js";
import { ObjectFormatter } from "./formatters/ObjectFormatter/ObjectFormatter.js";

const telegramBotToken = getEnv("telegramBotToken");
const telegramGroupId = +getEnv("telegramGroupId");
const bot = new TelegramBot(telegramBotToken, {
  polling: true,
});
const storage = new FileStorage();
const objectFormatter = new ObjectFormatter();

const runArbitrageServiceChild = new Monitor(
  "build/scripts/runArbitrageService.js",
  {
    max: 3,
  }
);

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  if (chatId !== telegramGroupId) {
    await handleUnwantedRequest(msg);
    return;
  }

  runArbitrageServiceChild.start();

  await bot.sendMessage(chatId, "Activated arbitrage calculation...");
});

bot.onText(/\/stop/, async (msg) => {
  const chatId = msg.chat.id;

  if (chatId !== telegramGroupId) {
    await handleUnwantedRequest(msg);
    return;
  }

  runArbitrageServiceChild.stop();

  await bot.sendMessage(chatId, "Stopped arbitrage calculation...");
});

bot.onText(/\/setProfit ([0-9]+)/, async (msg, match) => {
  const chatId = msg.chat.id;

  if (chatId !== telegramGroupId) {
    await handleUnwantedRequest(msg);
    return;
  }
  const minProfitPercent = match?.[1];
  if (!minProfitPercent) {
    return;
  }

  try {
    await storage.saveArbitrageConfig({ minProfitPercent: +minProfitPercent });
  } catch (e) {
    logger.error(e);
    return;
  }

  await bot.sendMessage(chatId, `Setting min profit to ${minProfitPercent}%`);
});

bot.onText(/\/config/, async (msg) => {
  const chatId = msg.chat.id;

  if (chatId !== telegramGroupId) {
    await handleUnwantedRequest(msg);
    return;
  }

  const arbitrageConfig = await storage.getArbitrageConfig();

  await bot.sendMessage(chatId, objectFormatter.format(arbitrageConfig));
});

bot.onText(/\/setRateLimit ([a-zA-Z]+) ([0-9]+)/, async (msg, match) => {
  const chatId = msg.chat.id;

  if (chatId !== telegramGroupId) {
    await handleUnwantedRequest(msg);
    return;
  }
  const exchange = match?.[1];
  const rateLimit = match?.[2];

  if (!exchange || !rateLimit) {
    return;
  }

  try {
    await storage.saveArbitrageConfig({
      rateLimits: {
        [exchange]: rateLimit,
      },
    });
  } catch (e) {
    logger.error(e);
    return;
  }

  const arbitrageConfig = await storage.getArbitrageConfig();

  await bot.sendMessage(chatId, objectFormatter.format(arbitrageConfig));
});

bot.onText(/\/defaultRateLimits/, async (msg) => {
  const chatId = msg.chat.id;

  if (chatId !== telegramGroupId) {
    await handleUnwantedRequest(msg);
    return;
  }

  const defaultRateLimits = getExchangeDefaultRateLimits();

  await bot.sendMessage(chatId, objectFormatter.format(defaultRateLimits));
});

const handleUnwantedRequest = async (msg: TelegramBot.Message) => {
  const perpetrator = msg.from?.username ?? "Someone";
  const message = `${perpetrator} outside is trying to use the bot`;
  logger.warn(message, msg);
  await bot.sendMessage(telegramGroupId, message);
};

process.on("uncaughtException", (err) => {
  logger.error(err.stack);
  logger.error("Node NOT Exiting...");
});
