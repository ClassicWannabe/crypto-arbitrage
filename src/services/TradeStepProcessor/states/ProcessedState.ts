import { ArbitrageStepStatus } from "../../../storages/types.js";
import { TradeStepProcessor } from "../TradeStepProcessor.js";
import { Params, State } from "./State.js";

export class ProcessedState extends State {
  status = ArbitrageStepStatus.PROCESSED;

  async process() {
    
  }
}
