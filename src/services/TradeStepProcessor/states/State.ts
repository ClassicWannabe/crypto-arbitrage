import { Exchange } from "../../../exchanges/types.js";
import { ArbitrageRepo } from "../../../storages/ArbitrageRepo/ArbitrageRepo.js";
import { TradeArbitrageStep } from "../../../storages/ddb/types.js";
import { ArbitrageStepStatus } from "../../../storages/types.js";

export type Params = {
  tradeStep: TradeArbitrageStep;
  arbitrageRepo: ArbitrageRepo;
  exchange: Exchange;
};

export abstract class State {
  static readonly status: ArbitrageStepStatus;

  abstract process(params: Params): Promise<void>;
}
