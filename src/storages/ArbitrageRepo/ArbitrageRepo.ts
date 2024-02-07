import {
  PrismaClient,
  ArbitrageStepType,
  Prisma,
  ArbitrageStatus,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { CreateEntityItem } from "electrodb";

import {
  tradeArbitrageStepDetails,
  withdrawArbitrageStepDetails,
} from "../schema.js";
import { ProcessableArbitrage, ProcessableArbitrageStatus } from "./types.js";
import { ArbitrageData, ExchangeEvent } from "../../types.js";
import { TradeStepEntity } from "../ddb/entities/TradeStepEntity.js";
import { WithdrawStepEntity } from "../ddb/entities/WithdrawStepEntity.js";
import { getTable } from "../ddb/helpers.js";
import { ArbitrageDataStatus } from "../types.js";

type TradeStepCreateInput = CreateEntityItem<typeof TradeStepEntity>;

type WithdrawStepCreateInput = CreateEntityItem<typeof WithdrawStepEntity>;

export class ArbitrageRepo {
  private readonly table = getTable();
  constructor() {}

  async getArbitrages(): Promise<ProcessableArbitrage[]> {
    const arbitrages = await this.table.entities.arbitrageData.scan
      .where(
        ({ status }, { eq }) =>
          `${eq(status, ArbitrageDataStatus.UNTOUCHED)} OR ${eq(status, ArbitrageDataStatus.PROCESSING)}`
      )
      .go({ pages: "all" });

    return (await Promise.all(
      arbitrages.data.map(async (arbitrage) => {
        return await this.table.collections
          .arbitrages({ arbitrageDataId: arbitrage.arbitrageDataId })
          .go();
      })
    )) as unknown as ProcessableArbitrage[];
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
      this.table.entities.arbitrageData
        .create({
          market: { baseCurrencyCode, quoteCurrencyCode, symbol },
          arbitrageDataId,
        })
        .go(),
      this.table.entities.tradeStep.put(tradeStepCreateInputs).go(),
      this.table.entities.withdrawStep.put(withdrawStepCreateInputs).go(),
    ]);
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
        amount: step.startCoin.amount,
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

  private parseStepDetails(type: ArbitrageStepType, details: unknown) {
    switch (type) {
      case ArbitrageStepType.TRADE: {
        return tradeArbitrageStepDetails.parse(details);
      }
      case ArbitrageStepType.WITHDRAW: {
        return withdrawArbitrageStepDetails.parse(details);
      }
    }

    throw new Error("Uknown step type:" + type);
  }

  async expireArbitrages(ids: string[]) {}

  async updateArbitrageStep(
    id: string,
    data: Prisma.ArbitrageStepUpdateInput
  ) {}

  async updateArbitrageData(
    id: string,
    data: Prisma.ArbitrageDataUpdateInput
  ) {}
}
