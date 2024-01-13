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

export class ArbitrageFormatter implements Formatter {
  format({ symbol, steps }: ArbitrageData): string {
    let message = this.formatSymbol(symbol);
    message += this.formatExchanges(steps);

    for (const step of steps) {
      switch (step.event) {
        case ExchangeEvent.TRADE: {
          message += this.formatTradeStep(step, symbol);
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

    return message;
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
    const { startCoin, endCoin, exchangeId, operation } = step;
    const operationWord = this.formatOperation(operation);
    return `Платформа: ${this.makeBold(
      exchangeId.toUpperCase()
    )}. Операция: ${operationWord} ${symbol}. Обмен ${this.formatCoin(
      startCoin
    )} на ${this.formatCoin(endCoin)}\n\n`;
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
    return `Итого: ${this.formatCoin(step.coin)}\n\n`;
  }

  private formatCoin(coin: CurrencyAmount) {
    return this.makeBold(`${coin.amount} ${coin.currencyCode}`);
  }

  private makeBold(text: string) {
    return `<b>${text}</b>`;
  }
}
