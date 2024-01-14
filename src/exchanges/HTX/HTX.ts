import { htx } from "ccxt";

import { AbstractExchange } from "../AbstractExchange/AbstractExchange.js";

export class HTX extends AbstractExchange {
  constructor(exchange: htx) {
    super(exchange);
  }
}
