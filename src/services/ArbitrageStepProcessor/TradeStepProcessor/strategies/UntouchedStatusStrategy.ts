import { Balance, Exchange, Order } from "../../../../exchanges/types.js";
import { logger } from "../../../../logger/logger.js";
import { ArbitrageRepo } from "../../../../storages/ArbitrageRepo/ArbitrageRepo.js";
import {
  ArbitrageData,
  TradeArbitrageStep,
} from "../../../../storages/ddb/types.js";
import {
  ArbitrageDataStatus,
  ArbitrageStepStatus,
} from "../../../../storages/types.js";
import { TradeOperation } from "../../../../types.js";
import { Strategy } from "../../Strategy.js";

export class UntouchedStatusStrategy extends Strategy {
  constructor(
    private readonly arbitrageRepo: ArbitrageRepo,
    private readonly exchange: Exchange,
    private readonly tradeStep: TradeArbitrageStep,
    private readonly arbitrageData: ArbitrageData
  ) {
    super();
  }

  async process() {
    try {
      return await this.processStep();
    } catch (e) {
      const error = e as Error;
      logger.error("Failed to process UNTOUCHED trade step", {
        error: error.stack,
      });

      return ArbitrageDataStatus.FAILED;
    }
  }

  private async processStep() {
    const balance = await this.exchange.getBalance();
    const order = await this.processTradeOperation(balance);

    return await this.updateStepDetails(order);
  }

  private async processTradeOperation(balance: Balance) {
    if (this.tradeStep.tradeOperation === TradeOperation.BUY) {
      return await this.processBuyOperation(balance);
    } else {
      return await this.processSellOperation(balance);
    }
  }

  private async processBuyOperation(balance: Balance): Promise<Order> {
    const requiredBalance = this.tradeStep.amount * this.tradeStep.price;
    const quoteCurrencyBalance =
      balance.free[this.arbitrageData.market.quoteCurrencyCode] ?? 0;

    if (quoteCurrencyBalance < requiredBalance) {
      throw new Error(
        `Insufficient balance. Exchange: ${this.exchange.id}. Currency: ${this.arbitrageData.market.quoteCurrencyCode}`
      );
    }

    return await this.exchange.createLimitBuyOrder(
      this.arbitrageData.market.symbol,
      this.tradeStep.amount,
      this.tradeStep.price
    );
  }

  private async processSellOperation(balance: Balance): Promise<Order> {
    const requiredBalance = this.tradeStep.amount;
    const baseCurrencyBalance =
      balance.free[this.arbitrageData.market.baseCurrencyCode] ?? 0;

    if (baseCurrencyBalance < requiredBalance) {
      throw new Error(
        `Insufficient balance. Exchange: ${this.exchange.id}. Currency: ${this.arbitrageData.market.baseCurrencyCode}`
      );
    }

    return await this.exchange.createLimitSellOrder(
      this.arbitrageData.market.symbol,
      this.tradeStep.amount,
      this.tradeStep.price
    );
  }

  private async updateStepDetails(order: Order) {
    const newStatus = ArbitrageStepStatus.PROCESSING;
    await this.arbitrageRepo.updateTradeStep(
      {
        tradeStepId: this.tradeStep.tradeStepId,
        arbitrageDataId: this.tradeStep.arbitrageDataId,
      },
      {
        status: newStatus,
        marketOrderId: order.id,
      }
    );

    return newStatus;
  }
}
