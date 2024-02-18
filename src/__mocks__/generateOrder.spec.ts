import { deepmerge } from "deepmerge-ts";
import { faker } from "@faker-js/faker";
import { PartialDeep } from "type-fest";

import { Order } from "../exchanges/types.js";
import { OrderStatus, TradeOperation } from "../types.js";

export const generateOrder = (order: PartialDeep<Order> = {}): Order => {
  const mock: Order = {
    amount: faker.number.float(),
    average: faker.number.float(),
    cost: faker.number.float(),
    filled: faker.number.float(),
    id: faker.string.uuid(),
    price: faker.number.float(),
    remaining: faker.number.float(),
    side: TradeOperation.BUY,
    status: OrderStatus.OPEN,
    symbol: faker.finance.currencySymbol(),
  };

  return deepmerge(mock, order) as Order;
};
