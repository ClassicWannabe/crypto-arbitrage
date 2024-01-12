import { okx } from "ccxt";

import { AbstractExchange } from "../Exchange/AbstractExchange.js";

export class OKX extends AbstractExchange {
  constructor(exchange: okx) {
    super(exchange);
  }
}
