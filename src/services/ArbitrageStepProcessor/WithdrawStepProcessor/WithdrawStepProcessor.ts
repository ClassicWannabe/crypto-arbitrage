import { Context } from "../Context.js";
import { Strategy } from "../Strategy.js";

export class WithdrawStepProcessor extends Context {
  constructor(private readonly strategy: Strategy) {
    super();
  }

  async process() {
    return await this.strategy.process();
  }
}
