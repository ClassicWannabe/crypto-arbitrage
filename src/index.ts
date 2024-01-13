import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { Monitor } from "forever-monitor";
import child from "child_process";

import { getEnv } from "./helpers.js";
import { logger } from "./logger/logger.js";

const telegramBotToken = getEnv("telegramBotToken");
const telegramGroupId = +getEnv("telegramGroupId");
const bot = new TelegramBot(telegramBotToken, {
  polling: true,
});

const runArbitrageServiceChild = new Monitor(
  "build/scripts/runArbitrageService.js",
  {
    max: 3,
    minUptime: 120_000,
    spinSleepTime: 120_000,
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

  runArbitrageServiceChild.send({ minProfitPercent: +minProfitPercent });

  await bot.sendMessage(chatId, `Setting min profit to ${minProfitPercent}%`);
});

const handleUnwantedRequest = async (msg: TelegramBot.Message) => {
  const perpetrator = msg.from?.username ?? "Someone";
  const message = `${perpetrator} outside is trying to use the bot`;
  logger.warn(message, msg);
  await bot.sendMessage(telegramGroupId, message);
};

process.on("uncaughtException", (err) => {
  logger.error("ERROR", err);
  logger.error("Node NOT Exiting...");
});
