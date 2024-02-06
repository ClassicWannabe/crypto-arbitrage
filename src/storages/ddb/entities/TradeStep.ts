import { Entity } from "electrodb";
import { randomUUID } from "crypto";

import { TABLE_NAME } from "../consts.js";
import { EntityType } from "../../types.js";
import { ArbitrageStepStatus } from "../../types.js";
import { FeeType, TradeOperation } from "../../../types.js";

export const TradeStep = new Entity({
  model: {
    entity: EntityType.TRADE_STEP,
    version: "1",
    service: TABLE_NAME,
  },
  attributes: {
    id: {
      type: "string",
      required: true,
      readOnly: true,
      set: () => randomUUID(),
    },
    arbitrageDataId: {
      type: "string",
      required: true,
      readOnly: true,
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
    fee: {
      type: "map",
      required: true,
      readOnly: true,
      properties: {
        amount: {
          type: "number",
          required: true,
        },
        type: {
          type: Object.values(FeeType),
          required: true,
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
  },
  indexes: {
    step: {
      pk: {
        field: "pk",
        composite: ["arbitrageDataId"],
      },
      sk: {
        field: "sk",
        composite: ["id"],
      },
    },
  },
});
