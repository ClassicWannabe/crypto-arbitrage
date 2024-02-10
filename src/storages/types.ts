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

export enum ArbitrageDataStatus {
  UNCONFIRMED = "UNCONFIRMED",
  PROCESSED = "PROCESSED",
  PROCESSING = "PROCESSING",
  UNTOUCHED = "UNTOUCHED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}
export enum ArbitrageStepType {
  TRADE = "TRADE",
  WITHDRAW = "WITHDRAW",
}
export enum ArbitrageStepStatus {
  PROCESSED = ArbitrageDataStatus.PROCESSED,
  PROCESSING = ArbitrageDataStatus.PROCESSING,
  UNTOUCHED = ArbitrageDataStatus.UNTOUCHED,
  FAILED = ArbitrageDataStatus.FAILED,
  CANCELLED = ArbitrageDataStatus.CANCELLED,
  EXPIRED = ArbitrageDataStatus.EXPIRED,
}
export enum EntityType {
  ARBITRAGE_DATA = "ARBITRAGE_DATA",
  TRADE_STEP = "TRADE_STEP",
  WITHDRAW_STEP = "WITHDRAW_STEP",
}
