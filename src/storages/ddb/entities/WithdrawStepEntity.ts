import { Entity } from "electrodb";
import { randomUUID } from "crypto";

import { EntityType } from "../../types.js";
import { ArbitrageStepStatus } from "../../types.js";
import { DDB_TABLE_NAME } from "../../../consts.js";
import { PARTITION_KEY_NAME, SORT_KEY_NAME } from "../consts.js";
import { FeeType } from "../../../types.js";

export const WithdrawStepEntity = new Entity({
  model: {
    entity: EntityType.WITHDRAW_STEP,
    version: "1",
    service: DDB_TABLE_NAME,
  },
  attributes: {
    withdrawStepId: {
      type: "string",
      required: true,
      readOnly: true,
      default: ( ) => randomUUID(),
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
    fee: {
      type: "map",
      required: true,
      readOnly: true,
      properties: {
        value: {
          type: "number",
          required: true,
        },
        type: {
          type: Object.values(FeeType),
          required: true,
        },
      },
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
    // step: {
    //   pk: {
    //     field: PARTITION_KEY_NAME,
    //     composite: ["arbitrageDataId"],
    //   },
    //   sk: {
    //     field: SORT_KEY_NAME,
    //     composite: ["id"],
    //   },
    // },
    withdrawSteps: {
      collection: "arbitrages",
      pk: {
        field: PARTITION_KEY_NAME,
        composite: ["arbitrageDataId"],
        template: "arbitrageData|${arbitrageDataId}",
      },
      sk: {
        field: SORT_KEY_NAME,
        composite: ["withdrawStepId"],
        template: "withdrawStep|${withdrawStepId}",
      },
    },
  },
});
