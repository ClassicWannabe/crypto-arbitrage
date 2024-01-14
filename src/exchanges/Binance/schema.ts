import { z } from "zod";

import {
  currencySchema as commonCurrencySchema,
  networkSchema,
} from "../schema.js";
import { Networks } from "../types.js";

export const binanceCurrencySchema = z.object({
  ...commonCurrencySchema.shape,
  networks: z.array(networkSchema).transform((networks) =>
    networks.reduce((result: Networks, item) => {
      result[item.network] = item;

      return result;
    }, {})
  ),
});

export const binanceCurrenciesSchema = z.record(
  z.string(),
  binanceCurrencySchema
);
