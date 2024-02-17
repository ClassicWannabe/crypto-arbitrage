import { ArbitrageDataStatus } from "../../storages/types.js";

export abstract class Context {
  abstract process(): Promise<ArbitrageDataStatus | null>;
}
