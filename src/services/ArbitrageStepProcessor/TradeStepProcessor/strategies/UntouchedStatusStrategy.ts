import { Balance, Exchange, Order } from "../../../../exchanges/types.js";
import { ArbitrageRepo } from "../../../../storages/ArbitrageRepo/ArbitrageRepo.js";
import {
  ArbitrageData,
  TradeArbitrageStep,
} from "../../../../storages/ddb/types.js";
import { ArbitrageStepStatus } from "../../../../storages/types.js";
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
    const balance = await this.exchange.getBalance();
    let order: Order;
    if (this.tradeStep.tradeOperation === TradeOperation.BUY) {
      order = await this.processBuyOperation(balance);
    } else {
      order = await this.processSellOperation(balance);
    }

    return await this.updateStepDetails(order);
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
