import { Entity } from "electrodb";
import { randomUUID } from "crypto";

import { ArbitrageStepType, EntityType } from "../../types.js";
import { ArbitrageStepStatus } from "../../types.js";
import { FeeType, TradeOperation } from "../../../types.js";
import { PARTITION_KEY_NAME, SORT_KEY_NAME } from "../consts.js";
import { getExpireAtValue } from "../helpers.js";

export const TradeStepEntity = new Entity({
  model: {
    entity: EntityType.TRADE_STEP,
    version: "1",
    service: "crypto-arbitrage",
  },
  attributes: {
    tradeStepId: {
      type: "string",
      required: true,
      readOnly: true,
      default: () => randomUUID(),
      set: () => randomUUID(),
    },
    arbitrageDataId: {
      type: "string",
      required: true,
      readOnly: true,
    },
    stepType: {
      type: [ArbitrageStepType.TRADE] as const,
      required: true,
      readOnly: true,
      default: () => ArbitrageStepType.TRADE,
      set: () => ArbitrageStepType.TRADE,
    },
    status: {
      type: Object.values(ArbitrageStepStatus),
      default: ArbitrageStepStatus.UNTOUCHED,
      required: true,
    },
    tradeOperation: {
      type: Object.values(TradeOperation),
      readOnly: true,
      required: true,
    },
    exchangeId: {
      type: "string",
      readOnly: true,
      required: true,
    },
    price: {
      type: "number",
      readOnly: true,
      required: true,
    },
    amount: {
      type: "number",
      readOnly: true,
      required: true,
    },
    stepOrder: {
      type: "number",
      required: true,
      readOnly: true,
    },
    marketOrderId: {
      type: "string",
    },
    fees: {
      type: "list",
      required: true,
      readOnly: true,
      items: {
        type: "map",
        required: true,
        readOnly: true,
        properties: {
          value: {
            type: "number",
            required: true,
            readOnly: true,
          },
          type: {
            type: Object.values(FeeType),
            required: true,
            readOnly: true,
          },
        },
      },
    },
    createdAt: {
      type: "string",
      readOnly: true,
      required: true,
      default: () => new Date().toISOString(),
      set: () => new Date().toISOString(),
    },
    updatedAt: {
      type: "string",
      watch: "*",
      required: true,
      default: () => new Date().toISOString(),
      set: () => new Date().toISOString(),
    },
    expireAt: {
      type: "number",
      required: true,
      readOnly: true,
      default: () => getExpireAtValue(),
      set: () => getExpireAtValue(),
    },
  },
  indexes: {
    tradeSteps: {
      collection: "arbitrages",
      pk: {
        field: PARTITION_KEY_NAME,
        composite: ["arbitrageDataId"],
        template: "arbitrageData|${arbitrageDataId}",
      },
      sk: {
        field: SORT_KEY_NAME,
        composite: ["tradeStepId"],
        template: "tradeStep|${tradeStepId}",
      },
    },
  },
});
