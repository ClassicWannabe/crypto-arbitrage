import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";

import {
  getEnv,
  getExchangeDefaultRateLimits,
  populateObject,
} from "./helpers.js";
import { logger } from "./logger/logger.js";
import { FileStorage } from "./storages/File/File.js";
import { ObjectFormatter } from "./formatters/ObjectFormatter/ObjectFormatter.js";
import { ScriptRunner } from "./services/ScriptRunner/ScriptRunner.js";
import { Script } from "./services/ScriptRunner/types.js";
import { ArbitrageRepo } from "./storages/ArbitrageRepo/ArbitrageRepo.js";
import { EmailPublisher } from "./publishers/EmailPublisher/EmailPublisher.js";
import { InitArbitrageCallbackQueryData } from "./bot/types.js";
import { initArbitrageCallbackQueryDataSchema } from "./bot/schema.js";
import { ArbitrageDataStatus } from "./storages/types.js";

const telegramBotToken = getEnv("telegramBotToken");
const telegramGroupId = +getEnv("telegramGroupId");
const bot = new TelegramBot(telegramBotToken, {
  polling: true,
});
const storage = new FileStorage();
const objectFormatter = new ObjectFormatter();
const arbitrageRepo = new ArbitrageRepo();
const emailPublisher = new EmailPublisher();

const arbitrageFinderScript = new ScriptRunner(Script.ARBITRAGE_FINDER);

// bot.onText(/\/but/, async (msg) => {
//   const chatId = msg.chat.id;

//   if (chatId !== telegramGroupId) {
//     await handleUnwantedRequest(msg);
//     return;
//   }
//   const data: InitArbitrageCallbackQueryData = {
//     arbitrageDataId: "41322c58-c820-4733-abd5-6bf51557efb8",
//   };

//   await bot.sendMessage(chatId, "Activated arbitrage calculation...", {
//     reply_markup: {
//       inline_keyboard: [
//         [{ text: "Подтвердить", callback_data: JSON.stringify(data) }],
//       ],
//     },
//   });
// });

// bot.on("callback_query", async (callbackQuery) => {
//   const chatId = callbackQuery.message?.chat.id;
//   const callbackQueryData = callbackQuery.data;

//   if (!chatId || !callbackQueryData) {
//     return;
//   }
//   const data = initArbitrageCallbackQueryDataSchema.parse(
//     JSON.parse(callbackQueryData)
//   );
//   const arbitrageData = await arbitrageRepo.getArbitrageData(data);
//   if (arbitrageData.status !== ArbitrageDataStatus.UNCONFIRMED) {
//     await bot.sendMessage(chatId, "Невозможно начать сделку");
//     return;
//   }

//   await emailPublisher.publish(
//     `Код подтверждения для ${arbitrageData.market.symbol}: ${arbitrageData.confirmationCode}`
//   );
//   await bot.sendMessage(
//     chatId,
//     `Отправлен код подтверждения для ${arbitrageData.market.symbol}`
//   );
// });

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  if (chatId !== telegramGroupId) {
    await handleUnwantedRequest(msg);
    return;
  }

  arbitrageFinderScript.start();
  await bot.sendMessage(chatId, "Activated arbitrage calculation...");
});

bot.onText(/\/stop/, async (msg) => {
  const chatId = msg.chat.id;

  if (chatId !== telegramGroupId) {
    await handleUnwantedRequest(msg);
    return;
  }

  arbitrageFinderScript.stop();
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
    return handleFailedRequest(chatId);
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

  await bot.sendMessage(chatId, objectFormatter.format(arbitrageConfig).text);
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
    return handleFailedRequest(chatId);
  }

  try {
    await storage.saveArbitrageConfig({
      rateLimits: {
        [exchange]: +rateLimit,
      },
    });
  } catch (e) {
    logger.error(e);
    return handleFailedRequest(chatId);
  }

  const arbitrageConfig = await storage.getArbitrageConfig();

  await bot.sendMessage(chatId, objectFormatter.format(arbitrageConfig).text);
});

bot.onText(
  /\/set ([a-zA-Z]+)(\.[a-zA-Z]+)*=[a-zA-Z0-9\.]+/,
  async (msg, match) => {
    const chatId = msg.chat.id;

    if (chatId !== telegramGroupId) {
      await handleUnwantedRequest(msg);
      return;
    }
    const command = match?.[0];
    if (!command) {
      return handleFailedRequest(chatId);
    }
    const [keysString, value] = command.replace("/set ", "").split("=");

    if (!keysString || !value) {
      return handleFailedRequest(chatId);
    }
    const isNumberValue = !Number.isNaN(Number(value));
    const keys = keysString.split(".");
    const config = populateObject(keys, isNumberValue ? +value : value);

    try {
      await storage.saveArbitrageConfig(config);
    } catch (e) {
      logger.error(e);
      return handleFailedRequest(chatId);
    }

    const arbitrageConfig = await storage.getArbitrageConfig();

    await bot.sendMessage(chatId, objectFormatter.format(arbitrageConfig).text);
  }
);

bot.onText(/\/addIgnoredSymbol (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;

  if (chatId !== telegramGroupId) {
    await handleUnwantedRequest(msg);
    return;
  }
  const ignoredSymbol = match?.[1];

  if (!ignoredSymbol) {
    return handleFailedRequest(chatId);
  }

  try {
    await storage.addIgnoredSymbol(ignoredSymbol);
  } catch (e) {
    logger.error(e);
    return handleFailedRequest(chatId);
  }

  const arbitrageConfig = await storage.getArbitrageConfig();

  await bot.sendMessage(chatId, objectFormatter.format(arbitrageConfig).text);
});

bot.onText(/\/removeIgnoredSymbol (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;

  if (chatId !== telegramGroupId) {
    await handleUnwantedRequest(msg);
    return;
  }
  const ignoredSymbol = match?.[1];

  if (!ignoredSymbol) {
    return handleFailedRequest(chatId);
  }

  try {
    await storage.removeIgnoredSymbol(ignoredSymbol);
  } catch (e) {
    logger.error(e);
    return handleFailedRequest(chatId);
  }

  const arbitrageConfig = await storage.getArbitrageConfig();

  await bot.sendMessage(chatId, objectFormatter.format(arbitrageConfig).text);
});

bot.onText(/\/defaultRateLimits/, async (msg) => {
  const chatId = msg.chat.id;

  if (chatId !== telegramGroupId) {
    await handleUnwantedRequest(msg);
    return;
  }

  const defaultRateLimits = getExchangeDefaultRateLimits();

  await bot.sendMessage(chatId, objectFormatter.format(defaultRateLimits).text);
});

const handleUnwantedRequest = async (msg: TelegramBot.Message) => {
  const perpetrator = msg.from?.username ?? "Someone";
  const message = `${perpetrator} outside is trying to use the bot`;
  logger.warn(message, msg);
  await bot.sendMessage(telegramGroupId, message);
};

const handleFailedRequest = async (chatId: number) => {
  await bot.sendMessage(chatId, "Something went wrong...");
};

await bot.sendMessage(telegramGroupId, "I am revived!!!");
