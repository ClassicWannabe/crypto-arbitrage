import { keyBy } from "lodash-es";
import {
  Currency as CcxtCurrency,
  Dictionary as CcxtDictionary,
  Market as CcxtMarket,
} from "ccxt";

import { Exchange } from "../../exchanges/types.js";
import { Bucket } from "../../storages/Bucket/Bucket.js";

type LoadedMarkets = {
  [exchangeId: string]: {
    markets: CcxtMarket[];
    currencies: CcxtDictionary<CcxtCurrency>;
  };
};

export class MarketLoader {
  private readonly fileName = "exchange-markets.json";

  constructor(
    private readonly bucket: Bucket,
    private readonly exchanges: Exchange[]
  ) {}

  async saveMarkets() {
    const exchangeData = await this.loadExchangeMarkets();

    await this.bucket.put(this.fileName, exchangeData);
  }

  private async loadExchangeMarkets(): Promise<LoadedMarkets> {
    const markets = await Promise.all(
      this.exchanges.map(async (exchange) => {
        await exchange.reloadMarkets();
        const markets = await exchange.getRawMarkets();
        const currencies = await exchange.getRawCurrencies();

        return {
          exchangeId: exchange.id,
          markets,
          currencies,
        };
      })
    );

    return keyBy(markets, "exchangeId");
  }

  async populateExchanges() {
    const exchangeMarkets = await this.getMarkets();

    for (const exchange of this.exchanges) {
      const foundMarkets = exchangeMarkets[exchange.id];
      if (!foundMarkets) {
        throw new Error("Cannot find markets to populate: " + exchange.id);
      }
      exchange.setRawMarkets(foundMarkets.markets, foundMarkets.currencies);
    }
  }

  async getMarkets(): Promise<LoadedMarkets> {
    const data = await this.bucket.get(this.fileName);

    if (!data) {
      throw new Error("Missing market data from the bucket");
    }

    return data as LoadedMarkets;
  }
}
