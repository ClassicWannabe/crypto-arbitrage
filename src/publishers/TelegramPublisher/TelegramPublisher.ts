import TelegramBot from "node-telegram-bot-api";

import { Publisher } from "../types.js";

type Options = {
  image?: Buffer;
  inlineKeyboard?: TelegramBot.InlineKeyboardMarkup;
};

export class TelegramPublisher implements Publisher {
  constructor(
    private readonly bot: TelegramBot,
    private readonly chatId: string | number
  ) {}

  async publish(message: string, options?: Options): Promise<void> {
    if (options?.image) {
      await this.bot.sendPhoto(this.chatId, options.image, {
        caption: message,
        parse_mode: "HTML",
        reply_markup: options.inlineKeyboard,
      });
      return;
    }
    await this.bot.sendMessage(this.chatId, message, {
      parse_mode: "HTML",
      reply_markup: options?.inlineKeyboard,
    });
  }
}
