import { z } from "zod";

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
  network: z.string(),
  active: z.boolean().nullish(),
  fee: z.number().nullish(),
});

export const networksSchema = z.record(z.string(), networkSchema);

export const currencySchema = z.object({
  code: z.string(),
  active: z.boolean(),
  fee: z.number().nullish(),
  networks: networksSchema,
});

export const currenciesSchema = z.record(z.string(), currencySchema);

export const quotationSchema = z
  .array(z.number())
  .transform(([quote, base]) => ({ quote: quote ?? 0, base: base ?? 0 }));

export const orderBookSchema = z.object({
  asks: z.array(quotationSchema),
  bids: z.array(quotationSchema),
  symbol: z.string(),
});
