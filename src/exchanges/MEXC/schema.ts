import { z } from "zod";
import { orderBookSchema as commonOrderBookSchema } from "../schema.js";

const mexcQuotationSchema = z
  .array(z.number())
  .transform(([quote, base]) => ({ quote: quote ?? 0, base: base ?? 0 }));

export const mexcOrderBookSchema = z.object({
  ...commonOrderBookSchema.shape,
  asks: z.array(mexcQuotationSchema),
  bids: z.array(mexcQuotationSchema),
});
