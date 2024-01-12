import { bybit } from "ccxt";

import { AbstractExchange } from "../Exchange/AbstractExchange.js";

export class Bybit extends AbstractExchange {
  constructor(exchange: bybit) {
    super(exchange);
  }
}
