import {
  ArbitrageData,
  ArbitrageSteps,
  ExchangeEvent,
  Fee,
  FeeType,
  TradeOperation,
} from "../../types.js";
import {
  Exchange,
  Network,
  OrderBook,
  Quotation,
} from "../../exchanges/types.js";
import { logger } from "../../logger/logger.js";

type ExchangePair = [Exchange, Exchange];

type NetworkPair = [Network, Network];

export class MultiExchangeCalculator {
  private readonly exchanges: Exchange[];
  private minProfitPercent = 0;

  constructor(exchanges: Exchange[], minProfitPercent = 0) {
    this.checkExchanges(exchanges);
    this.checkMinProfitPercent(minProfitPercent);
    this.exchanges = exchanges;
    this.minProfitPercent = minProfitPercent;
  }

  async calculate(
    symbol: string,
    shouldReloadExchanges = false
  ): Promise<ArbitrageData[]> {
    if (shouldReloadExchanges) {
      await this.reloadAllExchanges();
    }

    return await this.getArbitrages(symbol);
  }

  setMinProfitPercent(minProfitPercent: number) {
    this.checkMinProfitPercent(minProfitPercent);
    this.minProfitPercent = minProfitPercent;
  }

  private checkExchanges(exchanges: Exchange[]) {
    if (exchanges.length < 2) {
      throw new Error(
        `${MultiExchangeCalculator.name}: You need to provide at least two exchanges`
      );
    }
  }

  private checkMinProfitPercent(minProfitPercent: number) {
    if (minProfitPercent < 0) {
      throw new Error(
        `${MultiExchangeCalculator.name}: You need to provide non-negative prtofit percent`
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
    const exchangePairs = this.getExchangePermutations();
    const arbitrages: ArbitrageData[] = [];
    for (const [withdrawExchange, depositExchange] of exchangePairs) {
      const [withdrawExchangeMarketData, depositExchangeMarketData] =
        await Promise.all([
          withdrawExchange.getMarket(symbol, true),
          depositExchange.getMarket(symbol, true),
        ]);

      if (!withdrawExchangeMarketData || !depositExchangeMarketData) {
        logger.debug(
          `Missing active market data ${withdrawExchange.id}-${depositExchange.id}`
        );
        continue;
      }

      const baseCurrencyCode = withdrawExchangeMarketData.base;
      const quoteCurrencyCode = withdrawExchangeMarketData.quote;

      const [baseCurrencyCommonNetworks, quoteCurrencyCommonNetworks] =
        await Promise.all([
          this.getCommonActiveNetworkNames(
            [withdrawExchange, depositExchange],
            baseCurrencyCode
          ),
          this.getCommonActiveNetworkNames(
            [depositExchange, withdrawExchange],
            quoteCurrencyCode
          ),
        ]);

      if (
        !baseCurrencyCommonNetworks.length ||
        !quoteCurrencyCommonNetworks.length
      ) {
        logger.debug(
          `Missing common networks ${withdrawExchange.id}-${depositExchange.id}. Symbol: ${symbol}`
        );
        continue;
      }

      const [
        withdrawExchangeBaseCurrency,
        withdrawExchangeQuoteCurrency,
        depositExchangeBaseCurrency,
        depositExchangeQuoteCurrency,
      ] = await Promise.all([
        withdrawExchange.getCurrency(baseCurrencyCode, true),
        withdrawExchange.getCurrency(quoteCurrencyCode, true),
        depositExchange.getCurrency(baseCurrencyCode, true),
        depositExchange.getCurrency(quoteCurrencyCode, true),
      ]);
      if (
        !withdrawExchangeBaseCurrency ||
        !withdrawExchangeQuoteCurrency ||
        !depositExchangeBaseCurrency ||
        !depositExchangeQuoteCurrency
      ) {
        logger.debug(
          `Missing active currencies ${withdrawExchange.id}-${depositExchange.id}. Symbol: ${symbol}`
        );
        continue;
      }

      const [withdrawExchangeOrderBook, depositExchangeOrderBook] =
        await Promise.all([
          this.getOrderBook(withdrawExchange, symbol),
          this.getOrderBook(depositExchange, symbol),
        ]);

      if (!withdrawExchangeOrderBook || !depositExchangeOrderBook) {
        logger.debug(
          `Missing order books ${withdrawExchange.id}-${depositExchange.id}. Symbol: ${symbol}`
        );
        continue;
      }

      for (const networkName of baseCurrencyCommonNetworks) {
        const firstTradeEndAmount = Math.min(
          withdrawExchangeOrderBook.bestAsk.base,
          depositExchangeOrderBook.bestBid.base
        );
        const firstTradeStartAmount =
          firstTradeEndAmount * withdrawExchangeOrderBook.bestAsk.quote;

        const {
          withdrawExchangeTradeFee,
          depositExchangeTradeFee,
          withdrawFee,
        } = await this.calculateFees({
          withdrawExchange: withdrawExchange,
          depositExchange: depositExchange,
          currencyCode: baseCurrencyCode,
          networkName,
          symbol,
        });
        const withdrawAmount = this.deductFee(
          firstTradeEndAmount,
          withdrawExchangeTradeFee
        );
        const lastTradeStartAmount = this.deductFee(
          withdrawAmount,
          withdrawFee
        );
        const lastTradeEndAmount =
          depositExchangeOrderBook.bestBid.quote * lastTradeStartAmount;
        const finalAmount = this.deductFee(
          lastTradeEndAmount,
          depositExchangeTradeFee
        );

        const steps: ArbitrageSteps = [
          {
            event: ExchangeEvent.TRADE,
            exchangeId: withdrawExchange.id,
            operation: TradeOperation.BUY,
            startCoin: {
              amount: firstTradeStartAmount,
              currencyCode: quoteCurrencyCode,
            },
            endCoin: {
              amount: firstTradeEndAmount,
              currencyCode: baseCurrencyCode,
            },
          },
          { event: ExchangeEvent.PAY_FEE, ...withdrawExchangeTradeFee },
          {
            event: ExchangeEvent.WITHDRAW,
            network: networkName,
            coin: {
              amount: withdrawAmount,
              currencyCode: baseCurrencyCode,
            },
          },
          { event: ExchangeEvent.PAY_FEE, ...withdrawFee },
          {
            event: ExchangeEvent.TRADE,
            operation: TradeOperation.SELL,
            exchangeId: depositExchange.id,
            startCoin: {
              amount: lastTradeStartAmount,
              currencyCode: baseCurrencyCode,
            },
            endCoin: {
              amount: lastTradeEndAmount,
              currencyCode: quoteCurrencyCode,
            },
          },
          { event: ExchangeEvent.PAY_FEE, ...depositExchangeTradeFee },
          {
            event: ExchangeEvent.STATUS,
            coin: { amount: finalAmount, currencyCode: quoteCurrencyCode },
          },
        ];

        if (this.isArbitrageFeasible(firstTradeStartAmount, finalAmount)) {
          arbitrages.push({ symbol, steps });
        }
      }

      for (const networkName of quoteCurrencyCommonNetworks) {
        const firstTradeStartAmount = Math.min(
          withdrawExchangeOrderBook.bestBid.base,
          depositExchangeOrderBook.bestAsk.base
        );
        const firstTradeEndAmount =
          firstTradeStartAmount * withdrawExchangeOrderBook.bestBid.quote;

        const {
          withdrawExchangeTradeFee,
          depositExchangeTradeFee,
          withdrawFee,
        } = await this.calculateFees({
          withdrawExchange,
          depositExchange,
          networkName,
          symbol,
          currencyCode: quoteCurrencyCode,
        });
        const withdrawAmount = this.deductFee(
          firstTradeEndAmount,
          withdrawExchangeTradeFee
        );
        const lastTradeStartAmount = this.deductFee(
          withdrawAmount,
          withdrawFee
        );
        const lastTradeEndAmount =
          lastTradeStartAmount / depositExchangeOrderBook.bestAsk.quote;
        const finalAmount = this.deductFee(
          lastTradeEndAmount,
          depositExchangeTradeFee
        );

        const steps: ArbitrageSteps = [
          {
            event: ExchangeEvent.TRADE,
            exchangeId: withdrawExchange.id,
            operation: TradeOperation.SELL,
            startCoin: {
              amount: firstTradeStartAmount,
              currencyCode: baseCurrencyCode,
            },
            endCoin: {
              amount: firstTradeEndAmount,
              currencyCode: quoteCurrencyCode,
            },
          },
          { event: ExchangeEvent.PAY_FEE, ...withdrawExchangeTradeFee },
          {
            event: ExchangeEvent.WITHDRAW,
            network: networkName,
            coin: {
              amount: withdrawAmount,
              currencyCode: quoteCurrencyCode,
            },
          },
          { event: ExchangeEvent.PAY_FEE, ...withdrawFee },
          {
            event: ExchangeEvent.TRADE,
            operation: TradeOperation.BUY,
            exchangeId: depositExchange.id,
            startCoin: {
              amount: lastTradeStartAmount,
              currencyCode: quoteCurrencyCode,
            },
            endCoin: {
              amount: lastTradeEndAmount,
              currencyCode: baseCurrencyCode,
            },
          },
          { event: ExchangeEvent.PAY_FEE, ...depositExchangeTradeFee },
          {
            event: ExchangeEvent.STATUS,
            coin: { amount: finalAmount, currencyCode: baseCurrencyCode },
          },
        ];

        if (this.isArbitrageFeasible(firstTradeStartAmount, finalAmount)) {
          arbitrages.push({ symbol, steps });
        }
      }
    }

    return arbitrages;
  }

  private deductFee(amount: number, fee: Fee): number {
    if (fee.type === FeeType.PERCENT) {
      return amount - amount * fee.value;
    }
    return amount - fee.value;
  }

  private isArbitrageFeasible(startAmount: number, endAmount: number) {
    return (endAmount - startAmount) / startAmount >= this.minProfitPercent;
  }

  private async calculateFees({
    withdrawExchange,
    depositExchange,
    symbol,
    networkName,
    currencyCode,
  }: {
    withdrawExchange: Exchange;
    depositExchange: Exchange;
    symbol: string;
    networkName: string;
    currencyCode: string;
  }) {
    const emptyFee = { type: FeeType.FIXED, value: 0 };
    let [withdrawExchangeTradeFee, depositExchangeTradeFee, withdrawFee] =
      await Promise.all([
        withdrawExchange.calculateTradingFee(symbol),
        depositExchange.calculateTradingFee(symbol),
        withdrawExchange.calculateWithdrawFee(currencyCode, networkName),
      ]);
    withdrawExchangeTradeFee ??= emptyFee;
    depositExchangeTradeFee ??= emptyFee;
    withdrawFee ??= emptyFee;
    return { withdrawExchangeTradeFee, depositExchangeTradeFee, withdrawFee };
  }

  private async getCommonActiveNetworkNames(
    exchanges: ExchangePair,
    code: string
  ): Promise<string[]> {
    const networks = await this.getCommonActiveNetworks(exchanges, code);

    return networks.reduce<string[]>((names, [network1]) => {
      names.push(network1.network);
      return names;
    }, []);
  }

  private async getCommonActiveNetworks(
    [exchangeOne, exchangeTwo]: ExchangePair,
    code: string
  ): Promise<NetworkPair[]> {
    const [currencyOne, currencyTwo] = await Promise.all([
      exchangeOne.getCurrency(code, true),
      exchangeTwo.getCurrency(code, true),
    ]);

    if (!currencyOne || !currencyTwo) {
      return [];
    }

    const [networkOneMap, networkTwoMap] = await Promise.all([
      exchangeOne.getNetworks(code, true),
      exchangeTwo.getNetworks(code, true),
    ]);
    const networksOne = Object.values(networkOneMap);
    const networksTwo = Object.values(networkTwoMap);

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

  private isSameNetwork(networks: Network[]): boolean {
    const network = networks[0]?.network;
    for (const n of networks) {
      if (n.network !== network) {
        return false;
      }
    }
    return true;
  }

  private async getOrderBook(
    exchange: Exchange,
    symbol: string
  ): Promise<(OrderBook & { bestAsk: Quotation; bestBid: Quotation }) | null> {
    const orderBook = await exchange.getOrderBook(symbol);

    if (!orderBook || !orderBook.asks.length || !orderBook.bids.length) {
      logger.debug(`${symbol} orderBook is missing. Exchange: ${exchange.id}`);
      return null;
    }
    const bestAsk = orderBook.asks[0];
    const bestBid = orderBook.bids[0];
    if (!bestAsk || !bestBid) {
      logger.debug(
        `${symbol} orderBook does not have asks or bids. Exchange: ${exchange.id}`
      );
      return null;
    }

    return { ...orderBook, bestAsk, bestBid };
  }

  private getExchangePermutations(): ExchangePair[] {
    const permutations: ExchangePair[] = [];
    for (let i = 0; i < this.exchanges.length; i++) {
      for (let j = i + 1; j < this.exchanges.length; j++) {
        const exchangeOne = this.exchanges[i];
        const exchangeTwo = this.exchanges[j];

        if (!exchangeOne || !exchangeTwo) {
          continue;
        }

        permutations.push(
          [exchangeOne, exchangeTwo],
          [exchangeTwo, exchangeOne]
        );
      }
    }
    return permutations;
  }
}
