import { z } from "zod";

import { FeeType, TradeOperation } from "../types.js";

const rateLimitSchema = z.number().min(0).nullable();

export const rateLimitsSchema = z.object({
  okx: rateLimitSchema,
  binance: rateLimitSchema,
  kucoin: rateLimitSchema,
  mexc: rateLimitSchema,
  bybit: rateLimitSchema,
  htx: rateLimitSchema,
  gateio: rateLimitSchema,
  bitget: rateLimitSchema,
});

export const arbitrageConfigSchema = z.object({
  minProfitPercent: z.number().min(0),
  parallelProcessSymbolNumber: z.number().min(1),
  rateLimits: rateLimitsSchema,
  ignoredSymbols: z.array(z.string()),
  targetCoins: z.array(z.string()).nullable(),
  timeout: z.number().min(1000),
});

export const deepPartialArbitrageConfigSchema =
  arbitrageConfigSchema.deepPartial();
