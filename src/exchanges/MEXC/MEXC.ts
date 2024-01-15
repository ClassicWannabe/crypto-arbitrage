import { mexc } from "ccxt";

import { AbstractExchange } from "../AbstractExchange/AbstractExchange.js";

export class MEXC extends AbstractExchange {
  constructor(exchange: mexc) {
    super(exchange);
  }
}
