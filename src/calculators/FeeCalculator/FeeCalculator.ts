import { deepmerge } from "deepmerge-ts";

import { Exchange } from "../../exchanges/types.js";
import { Fee, FeeType } from "../../types.js";

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

type SavedFeesData = {
  exchangeId: string;
  symbolOrCurrencyCode: string;
  networkName?: string;
};

type SavedFee = {
  lastUpdate: Date;
  fees: Fee[];
};

type CurrencyFees = {
  [networkName: string]: SavedFee;
};

type SavedFees = {
  [exchangeId: string]: {
    [symbolOrCurrencyCode: string]: CurrencyFees | SavedFee;
  };
};

export class FeeCalculator {
  private savedFees: SavedFees = {};

  async calculateFees(args: CalculateFeesArgs): Promise<Fee[]> {
    let symbolOrCurrencyCode;
    let networkName;
    if (args.type === CalculatedFeeType.TRADE) {
      symbolOrCurrencyCode = args.symbol;
    } else {
      symbolOrCurrencyCode = args.currencyCode;
      networkName = args.networkName;
    }

    const savedFee = this.getSavedFee({
      exchangeId: args.exchange.id,
      networkName,
      symbolOrCurrencyCode,
    });

    if (savedFee) {
      return savedFee;
    }

    const newFee = await this.fetchNewFee(args);
    this.updateSavedFee(newFee, {
      exchangeId: args.exchange.id,
      symbolOrCurrencyCode,
      networkName,
    });

    return newFee;
  }

  private getSavedFee(data: SavedFeesData): Fee[] | null {
    return this.processSavedFee(data);
  }

  private processSavedFee({
    exchangeId,
    symbolOrCurrencyCode,
    networkName,
  }: SavedFeesData) {
    let savedFee: SavedFee | null;
    if (networkName) {
      const networkFees = this.savedFees[exchangeId]?.[symbolOrCurrencyCode] as
        | CurrencyFees
        | undefined;
      savedFee = networkFees?.[networkName] ?? null;
    } else {
      savedFee =
        (this.savedFees[exchangeId]?.[symbolOrCurrencyCode] as SavedFee) ??
        null;
    }

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
    return savedFee.fees;
  }

  private async fetchNewFee(args: CalculateFeesArgs) {
    let fees = [];
    if (args.type === CalculatedFeeType.TRADE) {
      const tradingFee = await args.exchange.getTradingFee(args.symbol);
      fees = tradingFee ? [tradingFee] : [];
    } else {
      fees = await args.exchange.getWithdrawFee(
        args.currencyCode,
        args.networkName
      );
    }

    return fees;
  }

  private updateSavedFee(
    fees: Fee[],
    { exchangeId, symbolOrCurrencyCode, networkName }: SavedFeesData
  ) {
    if (networkName) {
      this.savedFees[exchangeId] = deepmerge(this.savedFees[exchangeId], {
        [symbolOrCurrencyCode]: {
          [networkName]: { lastUpdate: new Date(), fees },
        },
      });
    } else {
      this.savedFees[exchangeId] = deepmerge(this.savedFees[exchangeId], {
        [symbolOrCurrencyCode]: { lastUpdate: new Date(), fees },
      });
    }
  }

  deductFee(amount: number, fee: Fee): number {
    if (fee.type === FeeType.PERCENT) {
      return amount - amount * fee.value;
    }
    return amount - fee.value;
  }

  deductFees(amount: number, fees: Fee[]): number {
    let result = amount;
    for (const fee of fees) {
      result = this.deductFee(result, fee);
    }
    return result;
  }
}
