import { z } from "zod";

const rateLimitSchema = z.number().min(0).nullable();

export const rateLimitsSchema = z.object({
  okx: rateLimitSchema,
  binance: rateLimitSchema,
  kucoin: rateLimitSchema,
  mexc: rateLimitSchema,
  bybit: rateLimitSchema,
  htx: rateLimitSchema,
  gateio: rateLimitSchema,
});

export const arbitrageConfigSchema = z.object({
  minProfitPercent: z.number().min(0),
  rateLimits: rateLimitsSchema,
});

export const deepPartialArbitrageConfigSchema =
  arbitrageConfigSchema.deepPartial();
