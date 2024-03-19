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
  WithdrawStepNetworkDetails,
} from "../../types.js";
import { Formatter } from "../types.js";
import { customDeepmerge } from "../../storages/helpers.js";
import { tableHbsPath } from "./consts.js";
import { Quotation } from "../../exchanges/types.js";

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
    const {
      startCoin,
      endCoin,
      exchangeId,
      operation,
      price,
      dayChangePercentage,
      isActive,
    } = step;
    const exchangeString = this.formatExchange(exchangeId);
    const priceString = this.formatPrice(price);
    const operationString = this.formatOperation({
      startCoin,
      endCoin,
      symbol,
      operation,
    });
    const dayChangePercentageString =
      this.formatDayChangePercentage(dayChangePercentage);
    const isActiveString = this.formatIsActive(isActive);

    return `${exchangeString}.\n${isActiveString}\n${priceString}.\n${dayChangePercentageString}\n${operationString}\n\n`;
  }

  private formatExchange(exchange: string) {
    return `Платформа: ${this.makeBold(exchange.toUpperCase())}`;
  }

  private formatPrice(price: number) {
    return `Цена: ${this.makeBold(this.formatNumber(price))}`;
  }

  private formatDayChangePercentage(percentage: number | null | undefined) {
    if (!percentage) {
      return "";
    }
    const str = `Изменение за 24ч: ${this.formatNumber(percentage, 3)}% `;
    if (percentage > 0) {
      return str + `📈`;
    }
    return str + `📉`;
  }

  private formatOperation({
    operation,
    startCoin,
    endCoin,
    symbol,
  }: Pick<TradeStep, "operation" | "startCoin" | "endCoin"> & {
    symbol: string;
  }) {
    const operationTypeString = this.formatOperationType(operation);
    const swapOperationString = this.formatSwapOperation({
      startCoin,
      endCoin,
    });
    return `Операция: ${operationTypeString} ${symbol}.\n${swapOperationString}`;
  }

  private formatSwapOperation({
    startCoin,
    endCoin,
  }: Pick<TradeStep, "startCoin" | "endCoin">) {
    return `Обмен ${this.formatCoin(startCoin)} на ${this.formatCoin(endCoin)}`;
  }

  private formatOperationType(operation: TradeOperation) {
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
    const {
      network: { name: networkName, withdrawNetwork, depositNetwork },
      coin,
    } = step;
    const withdrawNetworkString = this.formatNetworkDetails(
      "withdraw",
      withdrawNetwork
    );
    const depositNetworkString = this.formatNetworkDetails(
      "deposit",
      depositNetwork
    );
    const addressString = this.formatAddress(depositNetwork.address);

    return `Перенос по сети ${this.makeBold(networkName)} ${this.formatCoin(
      coin
    )}\n${addressString}\n${withdrawNetworkString}\n${depositNetworkString}\n\n`;
  }

  private formatAddress(address: string) {
    return `Адрес: ${address}`;
  }

  private formatNetworkDetails(
    type: "withdraw" | "deposit",
    details: WithdrawStepNetworkDetails
  ) {
    const isActiveString = this.formatIsActive(details.isActive);
    const isWithdrawableString = this.formatIsWithdrawable(
      details.isWithdrawable
    );
    const isDepositableString = this.formatIsDepositable(details.isDepositable);
    const exchangeString =
      type === "withdraw" ? "Сеть Платформы 1" : "Сеть Платформы 2";

    return `${exchangeString}\n${isActiveString}\n${isWithdrawableString}\n${isDepositableString}`;
  }

  private formatIsActive(isActive?: boolean | null) {
    return `Активный: ${this.formatBoolean(isActive)}`;
  }

  private formatIsWithdrawable(isWithdrawable?: boolean | null) {
    return `Снимаемый: ${this.formatBoolean(isWithdrawable)}`;
  }

  private formatIsDepositable(isDepositable?: boolean | null) {
    return `Пополняемый: ${this.formatBoolean(isDepositable)}`;
  }

  private formatStatusStep(step: StatusStep) {
    const { coin } = step;
    const profitString = this.formatProfit(step);

    return `Итого: ${this.formatCoin(coin)}.\n${profitString}\n\n`;
  }

  private formatProfit(step: StatusStep) {
    const { coin, profit } = step;

    return `Прибыль: ${this.formatCoin({ amount: profit.amount, currencyCode: coin.currencyCode, currencyName: coin.currencyName })} ~${this.formatNumber(
      profit.percent,
      3
    )}%`;
  }

  private formatCoin(coin: CurrencyAmount) {
    return this.makeBold(
      `${this.formatNumber(coin.amount)} ${coin.currencyCode} ${coin.currencyName ? `(${coin.currencyName})` : ""}`
    );
  }

  private makeBold(text: string) {
    return `<b>${text}</b>`;
  }

  private formatNumber(num: number, maximumFractionDigits: number = 18) {
    return num.toLocaleString(undefined, { maximumFractionDigits });
  }

  private formatBoolean(bool?: boolean | null) {
    if (typeof bool !== "boolean") {
      return `❓`;
    }
    return bool ? "➕" : "➖";
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
      const normalizedOrderBook = this.normalizeImageStepOrderBook(
        step.orderBook,
        step.usedQuotations
      );
      const normalizedStep = customDeepmerge(step, {
        orderBook: normalizedOrderBook,
      });
      normalizedSteps.push(normalizedStep);
    }
    return normalizedSteps;
  }

  private normalizeImageStepOrderBook(
    orderBook: TradeStep["orderBook"],
    usedQuotations: TradeStep["usedQuotations"]
  ) {
    const sliceLength = usedQuotations.length + 5;
    const asks = orderBook.asks.slice(0, sliceLength).map((quotation, idx) => {
      return {
        ...quotation,
        isUsed: idx < usedQuotations.length && usedQuotations.type === "asks",
      };
    });

    const bids = orderBook.bids.slice(0, sliceLength).map((quotation, idx) => {
      return {
        ...quotation,
        isUsed: idx < usedQuotations.length && usedQuotations.type === "bids",
      };
    });
    return { ...orderBook, asks: reverse(asks), bids };
  }
}
