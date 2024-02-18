import { deepmerge } from "deepmerge-ts";
import { PartialDeep } from "type-fest";

import { Balance } from "../exchanges/types.js";

export const generateBalance = (
  balance: PartialDeep<Balance> = {}
): Balance => {
  const mock: Balance = {
    free: {},
    total: {},
    used: {},
  };

  return deepmerge(mock, balance) as Balance;
};
