import { z } from "zod";

export const initArbitrageCallbackQueryDataSchema = z.object({
  arbitrageDataId: z.string().uuid(),
});
