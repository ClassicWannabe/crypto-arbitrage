import { z } from "zod";

import { initArbitrageCallbackQueryDataSchema } from "./schema.js";

export type InitArbitrageCallbackQueryData = z.infer<
  typeof initArbitrageCallbackQueryDataSchema
>;
