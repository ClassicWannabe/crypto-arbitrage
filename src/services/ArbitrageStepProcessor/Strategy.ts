import { ArbitrageDataStatus } from "../../storages/types.js";

export abstract class Strategy {
  abstract process(): Promise<ArbitrageDataStatus | null>;
}
