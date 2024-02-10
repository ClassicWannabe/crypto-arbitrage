import { Exchange } from "../../exchanges/types.js";
import { ArbitrageRepo } from "../../storages/ArbitrageRepo/ArbitrageRepo.js";
import { ArbitrageStepStatus } from "../../storages/types.js";
import { Service } from "../types.js";
import { State } from "./states/State.js";
import { STATES } from "./states/index.js";

export class TradeStepProcessor implements Service {
  private state: State;

  constructor(
    stepStatus: ArbitrageStepStatus,
    private readonly arbitrageRepo: ArbitrageRepo,
    private readonly exchanges: Exchange[]
  ) {
    this.state = this.getInitialState(stepStatus);
  }

  private getInitialState(stepStatus: ArbitrageStepStatus): State {
    const state = STATES[stepStatus];

    if (!state) {
      throw new Error("Cannot get initial trade step");
    }

    return new state();
  }

  transitionTo(state: State): void {
    this.state = state;
  }

  async process(): Promise<void> {
    // await this.state.process(this);
  }
}
