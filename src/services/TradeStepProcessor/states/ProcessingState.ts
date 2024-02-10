import { Exchange, Order } from "../../../exchanges/types.js";
import { TradeArbitrageStep } from "../../../storages/ddb/types.js";
import { ArbitrageStepStatus } from "../../../storages/types.js";
import { OrderStatus } from "../../../types.js";
import { Params, State } from "./State.js";

export class ProcessingState extends State {
  status = ArbitrageStepStatus.PROCESSING;

  async process({ exchange, tradeStep, arbitrageRepo }: Params) {
    // const order = await this.getOrder(tradeStep, exchange);
    // if (order.status === OrderStatus.OPEN) {
    //   return;
    // }
    // if (order.status === OrderStatus.CLOSED) {
    //   await arbitrageRepo.updateTradeStep(
    //     {
    //       arbitrageDataId: tradeStep.arbitrageDataId,
    //       tradeStepId: tradeStep.tradeStepId,
    //     },
    //     {
    //       status: ArbitrageStepStatus.PROCESSED,
    //     }
    //   );
    //   return;
    // }
    // await arbitrageRepo.updateTradeStep(
    //   {
    //     arbitrageDataId: tradeStep.arbitrageDataId,
    //     tradeStepId: tradeStep.tradeStepId,
    //   },
    //   {
    //     status: ArbitrageStepStatus.FAILED,
    //   }
    // );
  }

  // private async getOrder(
  //   tradeStep: TradeArbitrageStep,
  //   exchange: Exchange
  // ): Promise<Order> {
  //   const orderId = tradeStep.marketOrderId;
  //   if (!orderId) {
  //     throw new Error(
  //       `Order ID is missing in details. ArbitrageData ID: ${tradeStep.arbitrageDataId}. Arbitrage Step ID: ${tradeStep.tradeStepId}`
  //     );
  //   }
  //   return await exchange.getOrder(orderId, tradeStep.market.symbol);
  // }
}
