import { z } from "zod";
import {
  networkSchema as commonNetworkSchema,
  commonCurrencySchema,
} from "../schema.js";
import { Networks } from "../types.js";

const networkSchema = z.object({
  ...commonNetworkSchema.shape,
  network: z.string().nullish(),
});

const networksSchema = z
  .record(z.string(), networkSchema)
  .transform((networks) => {
    return Object.entries(networks).reduce<Networks>((acc, [key, network]) => {
      acc[key] = { ...network, network: key };
      return acc;
    }, {});
  });

export const kucoinCurrencySchema = z.object({
  ...commonCurrencySchema.shape,
  networks: networksSchema,
});

export const kucoinCurrenciesSchema = z.record(
  z.string(),
  kucoinCurrencySchema
);
