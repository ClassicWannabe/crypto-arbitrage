import { gateio } from "ccxt";

import { AbstractExchange } from "../AbstractExchange/AbstractExchange.js";

export class GateIO extends AbstractExchange {
  constructor(exchange: gateio) {
    super(exchange);
  }
}
