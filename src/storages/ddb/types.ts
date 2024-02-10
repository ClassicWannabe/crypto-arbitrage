import { CollectionItem, CreateEntityItem, Service } from "electrodb";

import { TradeStepEntity } from "./entities/TradeStepEntity.js";
import { WithdrawStepEntity } from "./entities/WithdrawStepEntity.js";
import { ArbitrageDataEntity } from "./entities/ArbitrageDataEntity.js";

export type TradeStepCreateInput = CreateEntityItem<typeof TradeStepEntity>;

export type WithdrawStepCreateInput = CreateEntityItem<
  typeof WithdrawStepEntity
>;

export type ArbitrageService = Service<{
  arbitrageData: typeof ArbitrageDataEntity;
  tradeStep: typeof TradeStepEntity;
  withdrawStep: typeof WithdrawStepEntity;
}>;

export type ArbitrageCollection = CollectionItem<
  ArbitrageService,
  "arbitrages"
>;

export type ArbitrageData = ArbitrageCollection["arbitrageData"][number];

export type TradeArbitrageStep = ArbitrageCollection["tradeStep"][number];

export type WithdrawArbitrageStep = ArbitrageCollection["withdrawStep"][number];

export type ArbitrageStep = TradeArbitrageStep | WithdrawArbitrageStep;
