import { ArbitrageData } from "../types.js";

export interface Formatter {
  format(data: ArbitrageData): string;
}
