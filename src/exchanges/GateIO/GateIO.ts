import { gateio } from "ccxt";

import { AbstractExchange } from "../AbstractExchange/AbstractExchange.js";
import { logger } from "../../logger/logger.js";
import { parseValue } from "../../helpers.js";
import { withdrawFeeSchema } from "./schema.js";
import { Fee, FeeType } from "../../types.js";

export class GateIO extends AbstractExchange {
  constructor(exchange: gateio) {
    super(exchange);
  }

  async getWithdrawFee(currencyCode: string, networkName?: string) {
    const fee = await this.exchange.fetchDepositWithdrawFee(currencyCode);

    const parsedFee = parseValue({ schema: withdrawFeeSchema, value: fee });

    const withdrawFix = parsedFee.info.withdraw_fix;
    const withdrawPercent = parsedFee.info.withdraw_percent;
    let fixFee = this.formatFee(withdrawFix, false);
    let percentFee = this.formatFee(withdrawPercent, true);

    if (networkName) {
      const networks = await this.getNetworks(currencyCode);
      const networkId = networks[networkName]?.id ?? networkName;
      const withdrawFixOnChain =
        parsedFee.info.withdraw_fix_on_chains[networkName] ??
        parsedFee.info.withdraw_fix_on_chains[networkId];
      const withdrawPercentOnChain =
        parsedFee.info.withdraw_percent_on_chains[networkName] ??
        parsedFee.info.withdraw_percent_on_chains[networkId];
      fixFee = withdrawFixOnChain
        ? this.formatFee(withdrawFixOnChain, false)
        : fixFee;
      percentFee = withdrawPercentOnChain
        ? this.formatFee(withdrawPercentOnChain, true)
        : percentFee;
    }

    return [percentFee, fixFee];
  }

  private formatFee(value: number, isPercent: boolean): Fee {
    return {
      value,
      type: isPercent ? FeeType.PERCENT : FeeType.FIXED,
    };
  }
}
