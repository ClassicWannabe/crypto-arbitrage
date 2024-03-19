import { gateio } from "ccxt";

import { AbstractExchange } from "../AbstractExchange/AbstractExchange.js";

export class GateIO extends AbstractExchange {
  constructor(exchange: gateio) {
    super(exchange);
  }

  // async getWithdrawFee(code: string, networkName?: string) {
  //   const fee = await super.getWithdrawFee(code, networkName);
  //   const f = await this.exchange.fetchDepositWithdrawFee(code);
  //   f.
  // }
}
