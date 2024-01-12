import { mexc } from "ccxt";

import { AbstractExchange } from "../Exchange/AbstractExchange.js";

export class MEXC extends AbstractExchange {
  constructor(exchange: mexc) {
    super(exchange);
  }
}
