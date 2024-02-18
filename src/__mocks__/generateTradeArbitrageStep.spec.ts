import { faker } from "@faker-js/faker";
import { PartialDeep } from "type-fest";
import { deepmerge } from "deepmerge-ts";

import { TradeArbitrageStep } from "../storages/ddb/types.js";
import { FeeType, TradeOperation } from "../types.js";
import { ArbitrageStepStatus, ArbitrageStepType } from "../storages/types.js";

export const generateTradeArbitrageStep = (
  tradeStep: PartialDeep<TradeArbitrageStep> = {}
): TradeArbitrageStep => {
  const mock: TradeArbitrageStep = {
    amount: 1.5,
    arbitrageDataId: faker.string.uuid(),
    exchangeId: faker.string.uuid(),
    fee: {
      type: FeeType.PERCENT,
      value: 0.1,
    },
    price: faker.number.float({ min: 0.1 }),
    status: ArbitrageStepStatus.UNTOUCHED,
    stepOrder: faker.number.int({ min: 0 }),
    stepType: ArbitrageStepType.TRADE,
    tradeOperation: TradeOperation.BUY,
    tradeStepId: faker.string.uuid(),
    marketOrderId: faker.string.uuid(),
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.past().toISOString(),
    expireAt: faker.date.future().getTime(),
  };

  return deepmerge(mock, tradeStep) as TradeArbitrageStep;
};
