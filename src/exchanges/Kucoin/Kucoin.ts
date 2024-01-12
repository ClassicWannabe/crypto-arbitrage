import { kucoin } from "ccxt";

import { AbstractExchange } from "../Exchange/AbstractExchange.js";

export class Kucoin extends AbstractExchange {
  constructor(exchange: kucoin) {
    super(exchange);
  }
}
