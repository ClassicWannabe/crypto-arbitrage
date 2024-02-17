import { Exchange, Order } from "../../../../exchanges/types.js";
import { ArbitrageRepo } from "../../../../storages/ArbitrageRepo/ArbitrageRepo.js";
import {
  ArbitrageData,
  TradeArbitrageStep,
} from "../../../../storages/ddb/types.js";
import { ArbitrageStepStatus } from "../../../../storages/types.js";
import { OrderStatus } from "../../../../types.js";
import { Strategy } from "../../Strategy.js";

export class ProcessingStatusStrategy extends Strategy {
  constructor(
    private readonly arbitrageRepo: ArbitrageRepo,
    private readonly exchange: Exchange,
    private readonly tradeStep: TradeArbitrageStep,
    private readonly arbitrageData: ArbitrageData
  ) {
    super();
  }

  async process() {
    const order = await this.getOrder();
    if (order.status === OrderStatus.OPEN) {
      return this.tradeStep.status;
    }
    if (order.status === OrderStatus.CLOSED) {
      const newStatus = ArbitrageStepStatus.PROCESSED;
      await this.arbitrageRepo.updateTradeStep(
        {
          arbitrageDataId: this.tradeStep.arbitrageDataId,
          tradeStepId: this.tradeStep.tradeStepId,
        },
        {
          status: newStatus,
        }
      );
      return newStatus;
    }

    const newStatus = ArbitrageStepStatus.FAILED;
    await this.arbitrageRepo.updateTradeStep(
      {
        arbitrageDataId: this.tradeStep.arbitrageDataId,
        tradeStepId: this.tradeStep.tradeStepId,
      },
      {
        status: newStatus,
      }
    );
    return newStatus;
  }

  private async getOrder(): Promise<Order> {
    const orderId = this.tradeStep.marketOrderId;
    if (!orderId) {
      throw new Error(
        `Order ID is missing in details. ArbitrageData ID: ${this.tradeStep.arbitrageDataId}. Arbitrage Step ID: ${this.tradeStep.tradeStepId}`
      );
    }
    return await this.exchange.getOrder(
      orderId,
      this.arbitrageData.market.symbol
    );
  }
}
