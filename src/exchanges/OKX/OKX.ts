import { okx } from "ccxt";

import { AbstractExchange } from "../AbstractExchange/AbstractExchange.js";

export class OKX extends AbstractExchange {
  constructor(exchange: okx) {
    super(exchange);
  }
}
