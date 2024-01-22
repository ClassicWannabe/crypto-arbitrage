import htmlToImage from "node-html-to-image";
import fs from "fs";
import { reverse } from "lodash-es";

import {
  ArbitrageData,
  ArbitrageSteps,
  CurrencyAmount,
  ExchangeEvent,
  FeeStep,
  FeeType,
  StatusStep,
  TradeOperation,
  TradeStep,
  WithdrawStep,
} from "../../types.js";
import { Formatter } from "../types.js";
import { customDeepmerge } from "../../storages/helpers.js";
import { tableHbsPath } from "./consts.js";

export class ArbitrageFormatter implements Formatter {
  async format({ symbol, steps }: ArbitrageData) {
    let message = this.formatSymbol(symbol);
    message += this.formatExchanges(steps);
    const tradeSteps = [];

    for (const step of steps) {
      switch (step.event) {
        case ExchangeEvent.TRADE: {
          message += this.formatTradeStep(step, symbol);
          tradeSteps.push(step);
          break;
        }
        case ExchangeEvent.PAY_FEE: {
          message += this.formatFeeStep(step);
          break;
        }
        case ExchangeEvent.WITHDRAW: {
          message += this.formatWitdrawStep(step);
          break;
        }
        case ExchangeEvent.STATUS: {
          message += this.formatStatusStep(step);
          break;
        }
      }
    }

    const image = await this.generateImage(tradeSteps);

    return { text: message, image };
  }

  private formatSymbol(symbol: string) {
    return `🤑 Пара: ${this.makeBold(symbol)} 💸\n`;
  }

  private formatExchanges(steps: ArbitrageSteps) {
    const exchanges = steps.reduce<string[]>((acc, step) => {
      if (step.event === ExchangeEvent.TRADE) {
        acc.push(step.exchangeId.toUpperCase());
      }
      return acc;
    }, []);
    return `Платформы: ${this.makeBold(exchanges.join("-"))} \n\n`;
  }

  private formatTradeStep(step: TradeStep, symbol: string) {
    const { startCoin, endCoin, exchangeId, operation, price } = step;
    const operationWord = this.formatOperation(operation);
    const exchangeString = `Платформа: ${this.makeBold(
      exchangeId.toUpperCase()
    )}`;
    const priceString = `Цена: ${this.makeBold(this.formatNumber(price))}`;
    const operationString = `Операция: ${operationWord} ${symbol}. Обмен ${this.formatCoin(
      startCoin
    )} на ${this.formatCoin(endCoin)}`;
    return `${exchangeString}. ${priceString}.\n${operationString}\n\n`;
  }

  private formatOperation(operation: TradeOperation) {
    return operation === TradeOperation.BUY ? "Покупка" : "Продажа";
  }

  private formatFeeStep(step: FeeStep) {
    const feeTypeWord = this.formatFeeType(step.type);
    return `Комиссия: ${this.makeBold(`${step.value}${feeTypeWord}`)} \n\n`;
  }

  private formatFeeType(feeType: FeeType) {
    return feeType === FeeType.PERCENT ? "%" : "";
  }

  private formatWitdrawStep(step: WithdrawStep) {
    const { network, coin } = step;
    return `Перенос по сети ${this.makeBold(network)} ${this.formatCoin(
      coin
    )}\n\n`;
  }

  private formatStatusStep(step: StatusStep) {
    return `Итого: ${this.formatCoin(step.coin)}. Прибыль: ${this.formatNumber(
      step.profitPercent,
      3
    )}%\n\n`;
  }

  private formatCoin(coin: CurrencyAmount) {
    return this.makeBold(
      `${this.formatNumber(coin.amount)} ${coin.currencyCode}`
    );
  }

  private makeBold(text: string) {
    return `<b>${text}</b>`;
  }

  private formatNumber(num: number, maximumFractionDigits: number = 18) {
    return num.toLocaleString(undefined, { maximumFractionDigits });
  }

  private async generateImage(steps: TradeStep[]) {
    const normalizedSteps = this.normalizeImageSteps(steps);
    const html = fs.readFileSync(tableHbsPath, {
      encoding: "utf-8",
    });
    const image = (await htmlToImage({
      html,
      content: { steps: normalizedSteps },
      puppeteerArgs: {
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--headless",
          "--no-zygote",
          "--disable-gpu",
        ],
        headless: true,
        ignoreHTTPSErrors: true,
      },
    })) as Buffer;

    return image;
  }

  private normalizeImageSteps(steps: TradeStep[]): TradeStep[] {
    const normalizedSteps = [];
    for (const step of steps) {
      const normalizedStep = customDeepmerge(step, {
        orderBook: {
          asks: reverse(step.orderBook.asks.slice(0, 5)),
          bids: step.orderBook.bids.slice(0, 5),
        },
      });
      normalizedSteps.push(normalizedStep);
    }
    return normalizedSteps;
  }
}
