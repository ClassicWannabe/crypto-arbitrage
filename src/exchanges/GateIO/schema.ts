import { z } from "zod";

const transformFixToNumber = z.string().transform((value) => +value);
const transformPercentToNumber = z
  .string()
  .transform((value) => +value.replace("%", ""));

export const withdrawFeeSchema = z.object({
  info: z.object({
    withdraw_fix: transformFixToNumber,
    withdraw_fix_on_chains: z.record(z.string(), transformFixToNumber),
    withdraw_percent: transformPercentToNumber,
    withdraw_percent_on_chains: z.record(z.string(), transformPercentToNumber),
  }),
});
