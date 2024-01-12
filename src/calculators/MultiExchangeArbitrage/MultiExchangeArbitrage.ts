import {
  ArbitrageData,
  ArbitrageStep,
  Fee,
  Quotation,
  TradeOperation,
  TrasnferOperation,
} from "../../types.js";
import {
  Currency,
  Exchange,
  Market,
  Network,
  OrderBook,
} from "../../exchanges/types.js";
import { logger } from "../../logger/logger.js";

type ExchangePair = [Exchange, Exchange];

type NetworkPair = [Network, Network];

type ArbitrageCalculationExchangeDetails = {
  exchange: Exchange;
  bestBidOrAsk: Quotation;
};

type ArbitrageCalculationParams = {
  symbol: string;
  transferCurrency: Currency;
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
        this.getActiveMarket(exchangeOne, symbol),
        this.getActiveMarket(exchangeTwo, symbol),
      ]);

      if (!exchangeOneMarketData || !exchangeTwoMarketData) {
        logger.debug(`Missing market data ${exchangeOne.id}-${exchangeTwo.id}`);
        continue;
      }

      const baseCurrencyCode = exchangeOneMarketData.base;
      const quoteCurrencyCode = exchangeOneMarketData.quote;

      const [baseCurrencyCommonNetworks, quoteCurrencyCommonNetworks] =
        await Promise.all([
          this.getCommonNetworkNames(
            [exchangeOne, exchangeTwo],
            baseCurrencyCode
          ),
          this.getCommonNetworks([exchangeTwo, exchangeOne], quoteCurrencyCode),
        ]);

      if (
        !baseCurrencyCommonNetworks.length ||
        !quoteCurrencyCommonNetworks.length
      ) {
        logger.debug(
          `Missing common networks ${exchangeOne.id}-${exchangeTwo.id}. Symbol: ${symbol}`
        );
        continue;
      }

      const [
        exchangeOneBaseCurrency,
        exchangeOneQuoteCurrency,
        exchangeTwoBaseCurrency,
        exchangeTwoQuoteCurrency,
      ] = await Promise.all([
        this.getActiveCurrency(exchangeOne, baseCurrencyCode),
        this.getActiveCurrency(exchangeOne, quoteCurrencyCode),
        this.getActiveCurrency(exchangeTwo, baseCurrencyCode),
        this.getActiveCurrency(exchangeTwo, quoteCurrencyCode),
      ]);

      if (
        !exchangeOneBaseCurrency ||
        !exchangeOneQuoteCurrency ||
        !exchangeTwoBaseCurrency ||
        !exchangeTwoQuoteCurrency
      ) {
        logger.debug(
          `Missing active currencies ${exchangeOne.id}-${exchangeTwo.id}. Symbol: ${symbol}`
        );
        continue;
      }

      const [exchangeOneOrderBook, exchangeTwoOrderBook] = await Promise.all([
        this.getOrderBook(exchangeOne, symbol),
        this.getOrderBook(exchangeTwo, symbol),
      ]);

      const forwardArbitrageProfitability =
        await this.calculateArbitrageProfitability({
          symbol,
          transferCurrency: exchangeOneBaseCurrency,
          buyExchange: {
            exchange: exchangeOne,
            bestBidOrAsk: exchangeOneOrderBook.bestAsk,
          },
          sellExchange: {
            exchange: exchangeTwo,
            bestBidOrAsk: exchangeTwoOrderBook.bestBid,
          },
        });
      if (forwardArbitrageProfitability) {
        const { fees, amount } = forwardArbitrageProfitability;
        arbitrages.push({
          symbol,
          fees,
          amount,
          networks: baseCurrencyCommonNetworks,
          steps: [
            {
              exchangeId: exchangeOne.id,
              bestAsk: exchangeOneOrderBook.bestAsk,
              bestBid: exchangeOneOrderBook.bestBid,
              operation: TradeOperation.BUY,
              price: exchangeOneOrderBook.bestAsk.price,
            },
            {
              exchangeId: exchangeTwo.id,
              bestAsk: exchangeTwoOrderBook.bestAsk,
              bestBid: exchangeTwoOrderBook.bestBid,
              operation: TradeOperation.SELL,
              price: exchangeTwoOrderBook.bestBid.price,
            },
          ],
        });
      }

      const reverseArbitrageProfitability =
        await this.calculateArbitrageProfitability({
          symbol,
          transferCurrency: exchangeTwoBaseCurrency,
          buyExchange: {
            exchange: exchangeTwo,
            bestBidOrAsk: exchangeTwoOrderBook.bestAsk,
          },
          sellExchange: {
            exchange: exchangeOne,
            bestBidOrAsk: exchangeOneOrderBook.bestBid,
          },
        });
      if (reverseArbitrageProfitability) {
        const { fees, amount } = reverseArbitrageProfitability;
        arbitrages.push({
          symbol,
          fees,
          amount,
          networks: baseCurrencyCommonNetworks,
          steps: [
            {
              exchangeId: exchangeTwo.id,
              bestAsk: exchangeTwoOrderBook.bestAsk,
              bestBid: exchangeTwoOrderBook.bestBid,
              operation: TradeOperation.BUY,
              price: exchangeTwoOrderBook.bestAsk.price,
            },
            {
              exchangeId: exchangeOne.id,
              bestAsk: exchangeOneOrderBook.bestAsk,
              bestBid: exchangeOneOrderBook.bestBid,
              operation: TradeOperation.SELL,
              price: exchangeOneOrderBook.bestBid.price,
            },
          ],
        });
      }
    }

    return arbitrages;
  }

  private async calculateArbitrageProfitability({
    symbol,
    transferCurrency,
    buyExchange: { exchange: buyExchange, bestBidOrAsk: buyQuotation },
    sellExchange: { exchange: sellExchange, bestBidOrAsk: sellQuotation },
  }: ArbitrageCalculationParams): Promise<{
    fees: Fee[];
    amount: number;
  } | null> {
    const profitOrLoss = sellQuotation.price - buyQuotation.price;
    const profitOrLossPercent = (profitOrLoss / buyQuotation.price) * 100;
    if (profitOrLossPercent < this.minProfitPercent) {
      return null;
    }
    const amount = Math.min(buyQuotation.volume, sellQuotation.volume);
    const fees = await this.calculateFees({
      symbol,
      amount,
      exchangePair: [buyExchange, sellExchange],
      transferCurrencyCode: transferCurrency.code,
    });
    const feesAmount = fees.map((fee) => fee.amount).reduce((a, b) => a + b, 0);
    const profit = profitOrLoss * amount;
    const profitDeductingFees = profit - feesAmount;
    const profitDeductingFeesPercent =
      (profitDeductingFees / (buyQuotation.price * amount)) * 100;

    if (profitDeductingFeesPercent < this.minProfitPercent) {
      return null;
    }

    return { fees, amount };
  }

  private async calculateFees({
    symbol,
    transferCurrencyCode,
    amount,
    exchangePair,
  }: {
    symbol: string;
    transferCurrencyCode: string;
    amount: number;
    exchangePair: ExchangePair;
  }): Promise<Fee[]> {
    const [buyExchange, sellExchange] = exchangePair;
    const [buyExchangeTradingFee, sellExchangeTradingFee, withdrawalFee] =
      await Promise.all([
        buyExchange.calculateTradingFee(symbol, amount),
        sellExchange.calculateTradingFee(symbol, amount),
        buyExchange.calculateWithdrawFee(transferCurrencyCode),
      ]);

    const fees: Fee[] = [];

    if (buyExchangeTradingFee) {
      fees.push({ amount: buyExchangeTradingFee, type: TradeOperation.BUY });
    }
    if (sellExchangeTradingFee) {
      fees.push({ amount: sellExchangeTradingFee, type: TradeOperation.SELL });
    }
    if (withdrawalFee) {
      fees.push({ amount: withdrawalFee, type: TrasnferOperation.WITHDRAW });
    }

    return fees;
  }

  // private async getActiveMarkets(
  //   exchanges: Exchange[],
  //   symbol: string
  // ): Promise<Record<string,Market> | null> {
  //   const markets = await Promise.all(
  //     exchanges.map((exchange) => ({ exchange, market: this.getMarket(exchange, symbol)}))
  //   );
  //   const [firstMarket, ...otherMarkets] = markets;

  //   if (exchanges.length !== markets.length) {
  //     return null;
  //   }

  //   return markets.reduce();
  // }

  private async getActiveMarket(
    exchange: Exchange,
    symbol: string
  ): Promise<Market | null> {
    const market = await exchange.getMarket(symbol);

    if (!market || market?.active === false) {
      return null;
    }

    return market;
  }

  private async getCommonNetworkNames(
    exchanges: ExchangePair,
    code: string
  ): Promise<string[]> {
    const networks = await this.getCommonNetworks(exchanges, code);

    return networks.reduce<string[]>((names, [network1, network2]) => {
      names.push(network1.network, network2.network);
      return names;
    }, []);
  }

  private async getCommonNetworks(
    [exchangeOne, exchangeTwo]: ExchangePair,
    code: string
  ): Promise<NetworkPair[]> {
    const [currencyOne, currencyTwo] = await Promise.all([
      this.getActiveCurrency(exchangeOne, code),
      this.getActiveCurrency(exchangeTwo, code),
    ]);

    if (!currencyOne || !currencyTwo) {
      return [];
    }

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

  private async getActiveCurrency(
    exchange: Exchange,
    code: string
  ): Promise<Currency | null> {
    const currency = await exchange.getCurrency(code);

    if (!currency || currency?.active === false) {
      return null;
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
