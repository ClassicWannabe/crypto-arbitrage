import { z } from "zod";
import { OrderStatus, TradeOperation, TransactionType } from "../types.js";

export const marketSchema = z.object({
  symbol: z.string(),
  base: z.string(),
  quote: z.string(),
  active: z.boolean(),
  percentage: z.boolean().nullish(),
  taker: z.number(),
  maker: z.number(),
});

export const marketsSchema = z.record(z.string(), marketSchema);

export const networkSchema = z.object({
  network: z.string().default("undefined"),
  active: z.boolean().nullish(),
  deposit: z.boolean().nullish(),
  withdraw: z.boolean().nullish(),
  fee: z.number().nullish(),
});

export const networksSchema = z.record(z.string(), networkSchema);

export const commonCurrencySchema = z.object({
  code: z.string(),
  name: z.string().optional(),
  active: z.boolean(),
  deposit: z.boolean().nullish(),
  withdraw: z.boolean().nullish(),
  fee: z.number().nullish(),
  networks: networksSchema,
});

const binanceCurrencySchema = z.object({
  ...commonCurrencySchema.shape,
  networks: z.array(networkSchema).transform((networks) =>
    networks.reduce((result: z.infer<typeof networksSchema>, item) => {
      result[item.network] = item;

      return result;
    }, {})
  ),
});

export const currencySchema = z.union([
  commonCurrencySchema,
  binanceCurrencySchema,
]);

export const currenciesSchema = z.record(z.string(), currencySchema);

export const quotationSchema = z
  .array(z.number())
  .transform(([quote, base]) => ({ quote: quote ?? 0, base: base ?? 0 }));

export const orderBookSchema = z.object({
  asks: z.array(quotationSchema),
  bids: z.array(quotationSchema),
  symbol: z.string(),
});

export const tickerSchema = z.object({
  symbol: z.string(),
  percentage: z.number().nullish(),
});

export const balanceSchema = z.object({
  free: z.record(z.string(), z.number()),
  used: z.record(z.string(), z.number()),
  total: z.record(z.string(), z.number()),
});

export const orderSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  status: z.nativeEnum(OrderStatus),
  side: z.nativeEnum(TradeOperation),
  price: z.number(),
  average: z.number(),
  amount: z.number(),
  filled: z.number(),
  remaining: z.number(),
  cost: z.number(),
});

export const transactionSchema = z.object({
  id: z.string(),
  addressFrom: z.string().nullish(),
  addressTo: z.string().nullish(),
  type: z.nativeEnum(TransactionType),
  amount: z.number(),
  currency: z.string(),
});

export const addressSchema = z.object({
  currency: z.string().min(1),
  network: z.string().min(1).nullish(),
  address: z.string().min(1),
});

const feeSchema = z.object({
  fee: z.number().nullish(),
  percentage: z.boolean().nullish(),
});

export const depositWithdrawFeeSchema = z.object({
  deposit: feeSchema,
  withdraw: feeSchema,
  networks: z.record(
    z.string(),
    z.object({ deposit: feeSchema, withdraw: feeSchema })
  ),
});
