import { bitget } from "ccxt";

import { AbstractExchange } from "../AbstractExchange/AbstractExchange.js";

export class BitGet extends AbstractExchange {
  constructor(exchange: bitget) {
    super(exchange);
  }
}
