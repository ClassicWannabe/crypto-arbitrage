import { Exchange } from "../../exchanges/types.js";
import { Fee, FeeType } from "../../types.js";

type CalculateFeesArgs = {
  withdrawExchange: Exchange;
  depositExchange: Exchange;
  symbol: string;
  networkName: string;
  currencyCode: string;
};

export type Fees = {
  withdrawExchangeTradeFee: Fee;
  depositExchangeTradeFee: Fee;
  withdrawFee: Fee;
};

export class FeeCalculator {
  private savedFees: { fees: Fees; lastUpdate: Date } | null = null;

  async calculateFees(args: CalculateFeesArgs): Promise<Fees> {
    const savedFees = this.getSavedFees();
    if (savedFees) {
      return savedFees;
    }

    const newFees = await this.fetchNewFees(args);
    this.updateSavedFees(newFees);

    return newFees;
  }

  private getSavedFees() {
    if (!this.savedFees) {
      return null;
    }
    const thirtyMinInMs = 50 * 60 * 1000;
    const now = Date.now();
    if (now - this.savedFees.lastUpdate.getTime() > thirtyMinInMs) {
      return null;
    }
    return this.savedFees.fees;
  }

  private async fetchNewFees({
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

  private updateSavedFees(fees: Fees) {
    this.savedFees = {
      fees,
      lastUpdate: new Date(),
    };
  }

  deductFee(amount: number, fee: Fee): number {
    if (fee.type === FeeType.PERCENT) {
      return amount - amount * fee.value;
    }
    return amount - fee.value;
  }
}
