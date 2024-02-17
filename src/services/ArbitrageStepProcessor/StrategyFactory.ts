import { ArbitrageStepStatus } from "../../storages/types.js";
import { Strategy } from "./Strategy.js";

export abstract class StrategyFactory {
  abstract getStrategy(status: ArbitrageStepStatus): Strategy;
}
