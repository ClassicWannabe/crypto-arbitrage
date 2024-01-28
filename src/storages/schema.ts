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
});

export const arbitrageConfigSchema = z.object({
  minProfitPercent: z.number().min(0),
  parallelProcessSymbolNumber: z.number().min(1),
  rateLimits: rateLimitsSchema,
  ignoredSymbols: z.array(z.string()),
});

export const deepPartialArbitrageConfigSchema =
  arbitrageConfigSchema.deepPartial();

export const tradeArbitrageStepDetails = z.object({
  operation: z.nativeEnum(TradeOperation),
  amount: z.number().positive(),
  price: z.number().positive(),
  exchange: z.string().min(1),
  fee: z.object({
    value: z.number().nonnegative(),
    type: z.nativeEnum(FeeType),
  }),
  orderId: z.string().min(1).nullish(),
});

const exchangeDetailsSchema = z.object({
  id: z.string().min(1),
  address: z.string().min(1).nullish(),
});

export const withdrawArbitrageStepDetails = z.object({
  amount: z.number().positive(),
  network: z.string().min(1),
  currency: z.string().min(1),
  exchanges: z.object({
    withdraw: exchangeDetailsSchema,
    deposit: exchangeDetailsSchema,
  }),
});
