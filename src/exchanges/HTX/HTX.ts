import { htx } from "ccxt";

import { AbstractExchange } from "../Exchange/AbstractExchange.js";

export class HTX extends AbstractExchange {
  constructor(exchange: htx) {
    super(exchange);
  }
}
