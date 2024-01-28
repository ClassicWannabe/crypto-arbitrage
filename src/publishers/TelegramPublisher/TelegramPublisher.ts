import TelegramBot from "node-telegram-bot-api";

import { Publisher } from "../types.js";

export class TelegramPublisher implements Publisher {
  constructor(
    private readonly bot: TelegramBot,
    private readonly chatId: string | number
  ) {}

  async publish(message: string, image?: Buffer): Promise<void> {
    if (image) {
      await this.bot.sendPhoto(this.chatId, image, {
        caption: message,
        parse_mode: "HTML",
      });
      return;
    }
    await this.bot.sendMessage(this.chatId, message, { parse_mode: "HTML" });
  }
}
