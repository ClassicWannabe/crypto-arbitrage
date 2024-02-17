import { ArbitrageDataStatus } from "../../../../storages/types.js";
import { Strategy } from "../../Strategy.js";

export class ProcessedStatusStrategy extends Strategy {
  constructor(private readonly isLastStep: boolean) {
    super();
  }

  async process() {
    if (!this.isLastStep) {
      return null;
    }
    return ArbitrageDataStatus.PROCESSED;
  }
}
