import { Exchange } from "../../exchanges/types.js";
import { Fee, FeeType } from "../../types.js";

type CalculateFeesArgs = {
  withdrawExchange: Exchange;
  depositExchange: Exchange;
  symbol: string;
  networkName: string;
  currencyCode: string;
};

export class FeeCalculator {
  async calculateFees({
    withdrawExchange,
    depositExchange,
    symbol,
    networkName,
    currencyCode,
  }: CalculateFeesArgs) {
    const emptyFee = { type: FeeType.FIXED, value: 0 };
    let [withdrawExchangeTradeFee, depositExchangeTradeFee, withdrawFee] =
      await Promise.all([
        withdrawExchange.getTradingFee(symbol),
        depositExchange.getTradingFee(symbol),
        withdrawExchange.getWithdrawFee(currencyCode, networkName),
      ]);
    withdrawExchangeTradeFee ??= emptyFee;
    depositExchangeTradeFee ??= emptyFee;
    withdrawFee ??= emptyFee;
    return { withdrawExchangeTradeFee, depositExchangeTradeFee, withdrawFee };
  }

  deductFee(amount: number, fee: Fee): number {
    if (fee.type === FeeType.PERCENT) {
      return amount - amount * fee.value;
    }
    return amount - fee.value;
  }
}
