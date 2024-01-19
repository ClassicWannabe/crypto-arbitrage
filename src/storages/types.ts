import { z } from "zod";

import {
  arbitrageConfigSchema,
  deepPartialArbitrageConfigSchema,
  rateLimitsSchema,
} from "./schema.js";

export interface Storage {
  getSymbols(): Promise<string[]>;
  saveSymbols(symbols: string[]): Promise<void>;
  addIgnoredSymbol(symbol: string): Promise<void>;
  removeIgnoredSymbol(symbol: string): Promise<void>;
  getArbitrageConfig(): Promise<ArbitrageConfig>;
  saveArbitrageConfig(config: Partial<ArbitrageConfig>): Promise<void>;
}

export type ArbitrageConfig = z.infer<typeof arbitrageConfigSchema>;
export type DeepPartialArbitrageConfig = z.infer<
  typeof deepPartialArbitrageConfigSchema
>;
export type RateLimits = z.infer<typeof rateLimitsSchema>;
