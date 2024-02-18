import { Exchange, Order } from "../../../../exchanges/types.js";
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
    try {
      return await this.processStep();
    } catch (e) {
      const error = e as Error;
      logger.error("Failed to process PROCESSING trade step", { error });

      return ArbitrageDataStatus.FAILED;
    }
  }

  private async processStep() {
    const order = await this.getOrder();

    switch (order.status) {
      case OrderStatus.OPEN: {
        return this.handleOpenOrderStatus();
      }
      case OrderStatus.CLOSED: {
        return await this.handleClosedOrderStatus();
      }
      default: {
        return await this.handleOtherOrderStatuses();
      }
    }
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

  private handleOpenOrderStatus() {
    return ArbitrageStepStatus.PROCESSING;
  }

  private async handleClosedOrderStatus() {
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

  private async handleOtherOrderStatuses() {
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
}
