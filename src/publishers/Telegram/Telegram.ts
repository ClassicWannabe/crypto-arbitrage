import TelegramBot from "node-telegram-bot-api";

import { Publisher } from "../types.js";

export class Telegram implements Publisher {
  constructor(
    private readonly bot: TelegramBot,
    private readonly chatId: string
  ) {}

  async publish(message: string): Promise<void> {
    await this.bot.sendMessage(this.chatId, message, { parse_mode: "HTML" });
  }
}
