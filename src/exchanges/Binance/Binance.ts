import { binance } from "ccxt";

import { AbstractExchange } from "../AbstractExchange/AbstractExchange.js";

export class Binance extends AbstractExchange {
  constructor(exchange: binance) {
    super(exchange);
  }
}
