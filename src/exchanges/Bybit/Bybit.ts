import { bybit } from "ccxt";

import { AbstractExchange } from "../AbstractExchange/AbstractExchange.js";

export class Bybit extends AbstractExchange {
  constructor(exchange: bybit) {
    super(exchange);
  }
}
