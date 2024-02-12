import { Entity } from "electrodb";
import { randomUUID } from "crypto";

import { EntityType } from "../../types.js";
import { ArbitrageDataStatus } from "../../types.js";
import { getConfirmationCode, getExpireAtValue } from "../helpers.js";
import { PARTITION_KEY_NAME, SORT_KEY_NAME } from "../consts.js";

export const ArbitrageDataEntity = new Entity({
  model: {
    entity: EntityType.ARBITRAGE_DATA,
    version: "1",
    service: "crypto-arbitrage",
  },
  attributes: {
    arbitrageDataId: {
      type: "string",
      required: true,
      readOnly: true,
      default: () => randomUUID(),
      set: () => randomUUID(),
    },
    status: {
      type: Object.values(ArbitrageDataStatus),
      default: ArbitrageDataStatus.UNCONFIRMED,
      required: true,
    },
    market: {
      type: "map",
      required: true,
      readOnly: true,
      properties: {
        symbol: {
          type: "string",
          required: true,
          readOnly: true,
        },
        baseCurrencyCode: {
          type: "string",
          required: true,
          readOnly: true,
        },
        quoteCurrencyCode: {
          type: "string",
          required: true,
          readOnly: true,
        },
      },
    },
    confirmationCode: {
      type: "string",
      required: true,
      readOnly: true,
      default: () => getConfirmationCode(),
      set: () => getConfirmationCode(),
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
    arbitrages: {
      collection: "arbitrages",
      pk: {
        field: PARTITION_KEY_NAME,
        composite: ["arbitrageDataId"],
        template: "arbitrageData|${arbitrageDataId}",
      },
      sk: {
        field: SORT_KEY_NAME,
        composite: ["arbitrageDataId"],
        template: "arbitrageData|${arbitrageDataId}",
      },
    },
  },
});
