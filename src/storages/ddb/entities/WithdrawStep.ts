import { Entity } from "electrodb";
import { randomUUID } from "crypto";

import { TABLE_NAME } from "../consts.js";
import { EntityType } from "../../types.js";
import { ArbitrageStepStatus } from "../../types.js";

export const WithdrawStep = new Entity({
  model: {
    entity: EntityType.WITHDRAW_STEP,
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
    networkId: {
      type: "string",
      readOnly: true,
      required: true,
    },
    currencyCode: {
      type: "string",
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
    transactionId: {
      type: "string",
    },
    exchanges: {
      type: "map",
      required: true,
      readOnly: true,
      properties: {
        withdraw: {
          type: "map",
          required: true,
          readOnly: true,
          properties: {
            id: {
              type: "string",
              required: true,
              readOnly: true,
            },
            address: {
              type: "string",
            },
          },
        },
        deposit: {
          type: "map",
          required: true,
          readOnly: true,
          properties: {
            id: {
              type: "string",
              required: true,
              readOnly: true,
            },
            address: {
              type: "string",
            },
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
