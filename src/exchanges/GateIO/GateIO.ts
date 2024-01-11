import { gateio } from "ccxt";

import { AbstractExchange } from "../Exchange/AbstractExchange.js";

export class GateIO extends AbstractExchange {
  constructor(exchange: gateio) {
    super(exchange);
  }
}
