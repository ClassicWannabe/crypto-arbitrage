import { Exchange } from "../../exchanges/types.js";
import { Fee, FeeType, Nullable } from "../../types.js";

export enum CalculatedFeeType {
  WITHDRAW = "withdraw",
  TRADE = "trade",
}

type CalculateFeesArgs =
  | {
      type: CalculatedFeeType.TRADE;
      exchange: Exchange;
      symbol: string;
    }
  | {
      type: CalculatedFeeType.WITHDRAW;
      exchange: Exchange;
      networkName: string;
      currencyCode: string;
    };

type GetSavedFeesArgs = {
  exchangeId: string;
  symbolOrCurrencyCode: string;
};

export type Fees = {
  withdrawExchangeTradeFee: Fee;
  depositExchangeTradeFee: Fee;
  withdrawFee: Fee;
};

type SavedFee = {
  lastUpdate: Date;
  fee: Fee;
};

type SavedFees = {
  [exchangeId: string]: {
    [symbolOrCurrencyCode: string]: SavedFee;
  };
};

export class FeeCalculator {
  private savedFees: SavedFees = {};

  async calculateFee(args: CalculateFeesArgs): Promise<Fee> {
    let symbolOrCurrencyCode;
    if (args.type === CalculatedFeeType.TRADE) {
      symbolOrCurrencyCode = args.symbol;
    } else {
      symbolOrCurrencyCode = args.currencyCode;
    }

    const savedFee = this.getSavedFee({
      exchangeId: args.exchange.id,
      symbolOrCurrencyCode,
    });

    if (savedFee) {
      return savedFee;
    }

    const newFee = await this.fetchNewFee(args);
    this.updateSavedFee(newFee, args.exchange.id, symbolOrCurrencyCode);

    return newFee;
  }

  private getSavedFee({
    exchangeId,
    symbolOrCurrencyCode,
  }: GetSavedFeesArgs): Fee | null {
    return this.processSavedFee(exchangeId, symbolOrCurrencyCode);
  }

  private processSavedFee(exchangeId: string, symbolOrCurrencyCode: string) {
    const savedFee = this.savedFees[exchangeId]?.[symbolOrCurrencyCode] ?? null;
    if (!savedFee) {
      return null;
    }
    const freshSavedFee = this.getFreshFee(savedFee);

    return freshSavedFee;
  }

  private getFreshFee(savedFee: SavedFee) {
    const thirtyMinInMs = 30 * 60 * 1000;
    const now = Date.now();

    if (now - savedFee.lastUpdate.getTime() > thirtyMinInMs) {
      return null;
    }
    return savedFee.fee;
  }

  private async fetchNewFee(args: CalculateFeesArgs) {
    const emptyFee = { type: FeeType.FIXED, value: 0 };
    let fee;
    if (args.type === CalculatedFeeType.TRADE) {
      fee = await args.exchange.getTradingFee(args.symbol);
    } else {
      fee = await args.exchange.getWithdrawFee(
        args.currencyCode,
        args.networkName
      );
    }

    return fee ?? emptyFee;
  }

  private updateSavedFee(
    fee: Fee,
    exchangeId: string,
    symbolOrCurrencyCode: string
  ) {
    this.savedFees[exchangeId] = {
      ...this.savedFees[exchangeId],
      [symbolOrCurrencyCode]: { lastUpdate: new Date(), fee },
    };
  }

  deductFee(amount: number, fee: Fee): number {
    if (fee.type === FeeType.PERCENT) {
      return amount - amount * fee.value;
    }
    return amount - fee.value;
  }

  addFee(amount: number, fee: Fee): number {
    if (fee.type === FeeType.PERCENT) {
      return amount + amount * fee.value;
    }
    return amount + fee.value;
  }
}
