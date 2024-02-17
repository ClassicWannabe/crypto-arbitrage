import { Exchange } from "../../../exchanges/types.js";
import { ArbitrageRepo } from "../../../storages/ArbitrageRepo/ArbitrageRepo.js";
import {
  ArbitrageData,
  TradeArbitrageStep,
} from "../../../storages/ddb/types.js";
import { ArbitrageStepStatus } from "../../../storages/types.js";
import { Strategy } from "../Strategy.js";
import { StrategyFactory } from "../StrategyFactory.js";
import { ProcessedStatusStrategy } from "./strategies/ProcessedStatusStrategy.js";
import { ProcessingStatusStrategy } from "./strategies/ProcessingStatusStrategy.js";
import { UntouchedStatusStrategy } from "./strategies/UntouchedStatusStrategy.js";

export class TradeStepStrategyFactory extends StrategyFactory {
  private readonly strategies: Record<ArbitrageStepStatus, Strategy | null>;

  constructor(
    arbitrageRepo: ArbitrageRepo,
    exchange: Exchange,
    tradeStep: TradeArbitrageStep,
    arbitrageData: ArbitrageData,
    isLastStep: boolean
  ) {
    super();

    this.strategies = {
      [ArbitrageStepStatus.PROCESSING]: new ProcessingStatusStrategy(
        arbitrageRepo,
        exchange,
        tradeStep,
        arbitrageData
      ),
      [ArbitrageStepStatus.UNTOUCHED]: new UntouchedStatusStrategy(
        arbitrageRepo,
        exchange,
        tradeStep,
        arbitrageData
      ),
      [ArbitrageStepStatus.PROCESSED]: new ProcessedStatusStrategy(isLastStep),
      [ArbitrageStepStatus.CANCELLED]: null,
      [ArbitrageStepStatus.EXPIRED]: null,
      [ArbitrageStepStatus.FAILED]: null,
    };
  }

  getStrategy(status: ArbitrageStepStatus): Strategy {
    const strategy = this.strategies[status];

    if (!strategy) {
      throw new Error(
        "A strategy is not impelemented for the given status: " + status
      );
    }

    return strategy;
  }
}
