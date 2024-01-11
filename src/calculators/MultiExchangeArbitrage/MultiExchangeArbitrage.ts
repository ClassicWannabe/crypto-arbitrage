import { ArbitrageData, Quotation, TradeOperation } from "../../types.js";
import {
  Currency,
  Exchange,
  Network,
  OrderBook,
} from "../../exchanges/types.js";

type ExchangePair = [Exchange, Exchange];

type NetworkPair = [Network, Network];

type ArbitrageCalculationExchangeDetails = {
  exchange: Exchange;
  quotation: Quotation;
};

type ArbitrageCalculationParams = {
  symbol: string;
  currency: Currency;
  network: Network;
  buyExchange: ArbitrageCalculationExchangeDetails;
  sellExchange: ArbitrageCalculationExchangeDetails;
};

export class MultiExchangeArbitrage {
  private readonly exchanges: Exchange[];
  private minProfitPercent = 0;

  constructor(exchanges: Exchange[], minProfitPercent = 0) {
    this.checkExchanges(exchanges);
    this.checkMinProfitPercent(minProfitPercent);
    this.exchanges = exchanges;
    this.minProfitPercent = minProfitPercent;
  }

  async calculate(symbols: string[]): Promise<ArbitrageData[]> {
    this.checkSymbols(symbols);

    await this.reloadAllExchanges();

    return (
      await Promise.all(
        symbols.map((symbol) => {
          return this.getArbitrages(symbol);
        })
      )
    ).flat();
  }

  setMinProfitPercent(minProfitPercent: number) {
    this.checkMinProfitPercent(minProfitPercent);
    this.minProfitPercent = minProfitPercent;
  }

  private checkSymbols(symbols: string[]) {
    if (symbols.length === 0) {
      throw new Error(
        `${MultiExchangeArbitrage.name}: You need to provide at least one symbol`
      );
    }
  }

  private checkExchanges(exchanges: Exchange[]) {
    if (exchanges.length < 2) {
      throw new Error(
        `${MultiExchangeArbitrage.name}: You need to provide at least two exchanges`
      );
    }
  }

  private checkMinProfitPercent(minProfitPercent: number) {
    if (minProfitPercent < 0) {
      throw new Error(
        `${MultiExchangeArbitrage.name}: You need to provide non-negative prtofit percent`
      );
    }
  }

  private async reloadAllExchanges() {
    await Promise.all(
      this.exchanges.map(async (exchange) => {
        await exchange.reloadMarkets();
      })
    );
  }

  private async getArbitrages(symbol: string): Promise<ArbitrageData[]> {
    const exchangePairs = this.getExchangeCombinations();
    const arbitrages: ArbitrageData[] = [];
    for (const [exchangeOne, exchangeTwo] of exchangePairs) {
      const [exchangeOneMarketData, exchangeTwoMarketData] = await Promise.all([
        this.getMarket(exchangeOne, symbol),
        this.getMarket(exchangeTwo, symbol),
      ]);

      const baseCurrencyCode = exchangeOneMarketData.base;
      const quoteCurrencyCode = exchangeOneMarketData.quote;

      const baseCurrencyCommonNetworks = await this.getCommonNetworks(
        [exchangeOne, exchangeTwo],
        baseCurrencyCode
      );
      const quoteCurrencyCommonNetworks = await this.getCommonNetworks(
        [exchangeTwo, exchangeOne],
        quoteCurrencyCode
      );
      if (
        !baseCurrencyCommonNetworks.length ||
        !quoteCurrencyCommonNetworks.length
      ) {
        continue;
      }

      const [
        exchangeOneBaseCurrency,
        exchangeOneQuoteCurrency,
        exchangeTwoBaseCurrency,
        exchangeTwoQuoteCurrency,
      ] = await Promise.all([
        this.getCurrency(exchangeOne, baseCurrencyCode),
        this.getCurrency(exchangeOne, quoteCurrencyCode),
        this.getCurrency(exchangeTwo, baseCurrencyCode),
        this.getCurrency(exchangeTwo, quoteCurrencyCode),
      ]);

      const [exchangeOneOrderBook, exchangeTwoOrderBook] = await Promise.all([
        this.getOrderBook(exchangeOne, symbol),
        this.getOrderBook(exchangeTwo, symbol),
      ]);

      const forwardArbitrage = await this.calculateArbitrageData({
        symbol,
        currency: exchangeOneBaseCurrency,
        network: baseCurrencyCommonNetworks[0]![0],
        buyExchange: {
          exchange: exchangeOne,
          quotation: exchangeOneOrderBook.bestAsk,
        },
        sellExchange: {
          exchange: exchangeTwo,
          quotation: exchangeTwoOrderBook.bestBid,
        },
      });
      if (forwardArbitrage) {
        arbitrages.push(forwardArbitrage);
      }

      const reverseArbitrage = await this.calculateArbitrageData({
        symbol,
        currency: exchangeTwoBaseCurrency,
        network: baseCurrencyCommonNetworks[0]![0],
        buyExchange: {
          exchange: exchangeTwo,
          quotation: exchangeTwoOrderBook.bestAsk,
        },
        sellExchange: {
          exchange: exchangeOne,
          quotation: exchangeOneOrderBook.bestBid,
        },
      });
      if (reverseArbitrage) {
        arbitrages.push(reverseArbitrage);
      }
    }

    return arbitrages;
  }

  private async calculateArbitrageData({
    symbol,
    currency,
    network,
    buyExchange: { exchange: buyExchange, quotation: buyQuotation },
    sellExchange: { exchange: sellExchange, quotation: sellQuotation },
  }: ArbitrageCalculationParams): Promise<ArbitrageData | null> {
    const profitOrLoss = buyQuotation.price - sellQuotation.price;
    const profitOrLossPercent = (profitOrLoss / buyQuotation.price) * 100;
    if (profitOrLossPercent < this.minProfitPercent) {
      return null;
    }
    const amount = Math.min(buyQuotation.volume, sellQuotation.volume);
    const buyExchangeTradingFee =
      (await buyExchange.calculateTradingFee(symbol, amount)) ?? 0;
    const sellExchangeTradingFee =
      (await sellExchange.calculateTradingFee(symbol, amount)) ?? 0;
    const withdrawalFee =
      (await buyExchange.calculateWithdrawFee(currency.code)) ?? 0;
    const profit = profitOrLoss * amount;
    const profitDeductingFees =
      profit - buyExchangeTradingFee - sellExchangeTradingFee - withdrawalFee;
    const profitDeductingFeesPercent =
      (profitDeductingFees / buyQuotation.price) * 100;

    if (profitDeductingFeesPercent < this.minProfitPercent) {
      return null;
    }

    return {
      network: network.network,
      symbol,
      steps: [
        {
          exchangeId: buyExchange.id,
          quotation: buyQuotation,
          amount,
          operation: TradeOperation.BUY,
          fees: [],
        },
        {
          exchangeId: sellExchange.id,
          quotation: sellQuotation,
          amount,
          operation: TradeOperation.SELL,
          fees: [],
        },
      ],
    };
  }

  private async getMarket(exchange: Exchange, symbol: string) {
    const market = await exchange.getMarket(symbol);

    if (market?.active === false) {
      throw new Error(`${symbol} market is inactive. Exchange: ${exchange.id}`);
    }

    return market;
  }

  private async getCommonNetworks(
    [exchangeOne, exchangeTwo]: ExchangePair,
    code: string
  ): Promise<NetworkPair[]> {
    const [currencyOne, currencyTwo] = await Promise.all([
      this.getCurrency(exchangeOne, code),
      this.getCurrency(exchangeTwo, code),
    ]);

    const networksOne = Object.values(currencyOne.networks);
    const networksTwo = Object.values(currencyTwo.networks);

    const commonNetworks = [];
    for (const networkOne of networksOne) {
      for (const networkTwo of networksTwo) {
        if (this.isSameNetwork([networkOne, networkTwo])) {
          const networkPair: NetworkPair = [networkOne, networkTwo];
          commonNetworks.push(networkPair);
        }
      }
    }
    return commonNetworks;
  }

  private async getCurrency(exchange: Exchange, code: string) {
    const currency = await exchange.getCurrency(code);

    if (currency?.active === false) {
      throw new Error(`${code} currency is inactive. Exchange: ${exchange.id}`);
    }

    return currency;
  }

  private async getOrderBook(
    exchange: Exchange,
    symbol: string
  ): Promise<OrderBook & { bestAsk: Quotation; bestBid: Quotation }> {
    const orderBook = await exchange.getOrderBook(symbol);

    if (!orderBook || !orderBook.asks.length || !orderBook.bids.length) {
      throw new Error(
        `${symbol} orderBook is missing. Exchange: ${exchange.id}`
      );
    }
    const bestAsk = orderBook.asks[0];
    const bestBid = orderBook.bids[0];
    if (!bestAsk || !bestBid) {
      throw new Error(
        `${symbol} orderBook does not have asks or bids. Exchange: ${exchange.id}`
      );
    }

    return { ...orderBook, bestAsk, bestBid };
  }

  private getExchangeCombinations(): ExchangePair[] {
    const combinations: ExchangePair[] = [];
    for (let i = 0; i < this.exchanges.length; i++) {
      for (let j = i + 1; j < this.exchanges.length; j++) {
        const exchangeOne = this.exchanges[i];
        const exchangeTwo = this.exchanges[j];

        if (!exchangeOne || !exchangeTwo) {
          continue;
        }

        combinations.push([exchangeOne, exchangeTwo]);
      }
    }
    return combinations;
  }

  private isSameNetwork(networks: Network[]): boolean {
    const network = networks[0]?.network;
    for (const n of networks) {
      if (n.network !== network) {
        return false;
      }
    }
    return true;
  }
}
