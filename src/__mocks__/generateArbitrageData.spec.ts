import { faker } from "@faker-js/faker";
import { PartialDeep } from "type-fest";
import { deepmerge } from "deepmerge-ts";

import { ArbitrageData } from "../storages/ddb/types.js";
import { ArbitrageDataStatus } from "../storages/types.js";

export const generateArbitrageData = (
  arbitrageData: PartialDeep<ArbitrageData> = {}
): ArbitrageData => {
  const mock: ArbitrageData = {
    confirmationCode: faker.string.numeric({ length: 6 }),
    arbitrageDataId: faker.string.uuid(),
    market: {
      baseCurrencyCode: faker.finance.currencyCode(),
      quoteCurrencyCode: faker.finance.currencyCode(),
      symbol: faker.finance.currencySymbol(),
    },
    status: ArbitrageDataStatus.UNTOUCHED,
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.past().toISOString(),
    expireAt: faker.date.future().getTime(),
  };

  return deepmerge(mock, arbitrageData) as ArbitrageData;
};
