import {
  ArbitrageData,
  ArbitrageStatus,
  ArbitrageStep,
  ArbitrageStepType,
} from "@prisma/client";

import {
  TradeArbitrageStepDetails,
  WithdrawArbitrageStepDetails,
} from "../types.js";

export type ProcessableArbitrageStatus = Extract<
  ArbitrageStatus,
  "UNTOUCHED" | "PROCESSING"
>;

type CommonArbitrageStep = Omit<ArbitrageStep, "details" | "type">;

export type TradeArbitrageStep = CommonArbitrageStep & {
  type: typeof ArbitrageStepType.TRADE;
  details: TradeArbitrageStepDetails;
};

export type WithdrawArbitrageStep = CommonArbitrageStep & {
  type: typeof ArbitrageStepType.WITHDRAW;
  details: WithdrawArbitrageStepDetails;
};

export type ProcessableArbitrage = ArbitrageData & {
  status: Extract<ArbitrageStatus, "UNTOUCHED" | "PROCESSING">;
  arbitrageSteps: (TradeArbitrageStep | WithdrawArbitrageStep)[];
};
