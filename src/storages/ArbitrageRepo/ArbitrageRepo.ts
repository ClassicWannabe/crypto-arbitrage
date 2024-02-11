import { EntityIdentifiers, UpdateEntityItem } from "electrodb";

import { ArbitrageData, ExchangeEvent } from "../../types.js";
import { ArbitrageDataStatus } from "../types.js";
import { DdbTableSingleton } from "../ddb/DdbTableSingleton.js";
import {
  ArbitrageCollection,
  TradeStepCreateInput,
  WithdrawStepCreateInput,
} from "../ddb/types.js";
import { ArbitrageDataEntity } from "../ddb/entities/ArbitrageDataEntity.js";
import { TradeStepEntity } from "../ddb/entities/TradeStepEntity.js";
import { WithdrawStepEntity } from "../ddb/entities/WithdrawStepEntity.js";

export class ArbitrageRepo {
  private readonly table = DdbTableSingleton.getTable();

  async getArbitrages(): Promise<ArbitrageCollection[]> {
    const arbitrages = await this.table.entities.arbitrageData.scan
      .where(
        ({ status }, { eq }) =>
          `${eq(status, ArbitrageDataStatus.UNTOUCHED)} OR ${eq(status, ArbitrageDataStatus.PROCESSING)}`
      )
      .go({ pages: "all" });

    return await Promise.all(
      arbitrages.data.map(async (arbitrage) => {
        const response = await this.table.collections
          .arbitrages({ arbitrageDataId: arbitrage.arbitrageDataId })
          .go();
        return response.data;
      })
    );
  }

  async getArbitrageData(id: EntityIdentifiers<typeof ArbitrageDataEntity>) {
    const result = await this.table.entities.arbitrageData.get(id).go();
    if (!result.data) {
      throw new Error(
        "Could not find arbitrage data by ID:" + id.arbitrageDataId
      );
    }
    return result.data;
  }

  async saveArbitrage(arbitrage: ArbitrageData) {
    const { baseCurrencyCode, quoteCurrencyCode, steps, symbol } = arbitrage;
    const arbitrageData = await this.table.entities.arbitrageData
      .create({
        market: { baseCurrencyCode, quoteCurrencyCode, symbol },
      })
      .go();

    const arbitrageDataId = arbitrageData.data.arbitrageDataId;

    const tradeStepCreateInputs = this.getTradeStepCreateInputs(
      steps,
      arbitrageDataId
    );
    const withdrawStepCreateInputs = this.getWithdrawStepCreateInputs(
      steps,
      arbitrageDataId
    );

    await Promise.all([
      this.table.entities.tradeStep.put(tradeStepCreateInputs).go(),
      this.table.entities.withdrawStep.put(withdrawStepCreateInputs).go(),
    ]);

    return arbitrageData.data;
  }

  private getTradeStepCreateInputs(
    steps: ArbitrageData["steps"],
    arbitrageDataId: string
  ): TradeStepCreateInput[] {
    return steps.reduce<TradeStepCreateInput[]>((acc, step, index) => {
      if (step.event !== ExchangeEvent.TRADE) {
        return acc;
      }

      acc.push({
        stepOrder: index + 1,
        amount: step.amount,
        arbitrageDataId,
        tradeOperation: step.operation,
        exchangeId: step.exchangeId,
        price: step.price,
        fee: step.fee,
      });
      return acc;
    }, []);
  }

  private getWithdrawStepCreateInputs(
    steps: ArbitrageData["steps"],
    arbitrageDataId: string
  ): WithdrawStepCreateInput[] {
    return steps.reduce<WithdrawStepCreateInput[]>((acc, step, index) => {
      if (step.event !== ExchangeEvent.WITHDRAW) {
        return acc;
      }
      acc.push({
        stepOrder: index + 1,
        arbitrageDataId,
        networkId: step.network.name,
        exchanges: {
          deposit: { id: step.exchanges.depositExchangeId },
          withdraw: { id: step.exchanges.withdrawExchangeId },
        },
        fee: step.fee,
        amount: step.coin.amount,
        currencyCode: step.coin.currencyCode,
      });
      return acc;
    }, []);
  }

  async updateTradeStep(
    id: EntityIdentifiers<typeof TradeStepEntity>,
    data: UpdateEntityItem<typeof TradeStepEntity>
  ) {
    return await this.table.entities.tradeStep.patch(id).set(data).go();
  }

  async updateWithdrawStep(
    id: EntityIdentifiers<typeof WithdrawStepEntity>,
    data: UpdateEntityItem<typeof WithdrawStepEntity>
  ) {
    return await this.table.entities.withdrawStep.patch(id).set(data).go();
  }

  async updateArbitrageData(
    id: EntityIdentifiers<typeof ArbitrageDataEntity>,
    data: UpdateEntityItem<typeof ArbitrageDataEntity>
  ) {
    return await this.table.entities.arbitrageData.patch(id).set(data).go();
  }
}
