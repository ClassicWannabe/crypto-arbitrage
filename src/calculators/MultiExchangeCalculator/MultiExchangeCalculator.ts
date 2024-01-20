import {
  ArbitrageData,
  ArbitrageSteps,
  ExchangeEvent,
  Fee,
  FeeType,
  TradeOperation,
} from "../../types.js";
import { Exchange, Network, OrderBook } from "../../exchanges/types.js";
import { logger } from "../../logger/logger.js";
import { FeeCalculator } from "../FeeCalculator/FeeCalculator.js";

type ExchangePair = [Exchange, Exchange];

type NetworkPair = [Network, Network];

type CalculateArbitrageStepsParams = {
  withdrawExchangeOrderBook: OrderBook;
  depositExchangeOrderBook: OrderBook;
  withdrawExchange: Exchange;
  depositExchange: Exchange;
  symbol: string;
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  networkName: string;
};

export class MultiExchangeCalculator {
  private readonly exchanges: Exchange[];
  private minProfitPercent = 0;

  constructor(exchanges: Exchange[], minProfitPercent = 0) {
    this.checkExchanges(exchanges);
    this.checkMinProfitPercent(minProfitPercent);
    this.exchanges = exchanges;
    this.minProfitPercent = minProfitPercent;
  }

  async calculate(symbol: string): Promise<ArbitrageData[]> {
    return await this.getArbitrages(symbol);
  }

  async reloadAllExchanges() {
    await Promise.all(
      this.exchanges.map(async (exchange) => {
        await exchange.reloadMarkets();
      })
    );
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

  private async getArbitrages(symbol: string): Promise<ArbitrageData[]> {
    const exchangePairs = this.getExchangePermutations();
    const arbitrages: ArbitrageData[] = await this.calculateArbitrageData(
      exchangePairs,
      symbol
    );

    this.resetOrderBookCaches();

    return arbitrages;
  }

  private resetOrderBookCaches() {
    for (const exchange of this.exchanges) {
      exchange.resetOrderBookCache();
    }
  }

  private async calculateArbitrageData(
    exchangePairs: ExchangePair[],
    symbol: string
  ) {
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
          withdrawExchange.getOrderBook(symbol, 1),
          depositExchange.getOrderBook(symbol, 1),
        ]);

      if (!withdrawExchangeOrderBook || !depositExchangeOrderBook) {
        logger.debug(
          `Missing order books ${withdrawExchange.id}-${depositExchange.id}. Symbol: ${symbol}`
        );
        continue;
      }

      for (const networkName of baseCurrencyCommonNetworks) {
        const steps = await this.calculateForwardArbitrageSteps({
          withdrawExchange,
          depositExchange,
          withdrawExchangeOrderBook,
          depositExchangeOrderBook,
          symbol,
          baseCurrencyCode,
          quoteCurrencyCode,
          networkName,
        });

        if (steps) {
          arbitrages.push({ symbol, steps });
        }
      }

      for (const networkName of quoteCurrencyCommonNetworks) {
        const steps = await this.calculateReverseArbitrageSteps({
          withdrawExchange,
          depositExchange,
          withdrawExchangeOrderBook,
          depositExchangeOrderBook,
          symbol,
          baseCurrencyCode,
          quoteCurrencyCode,
          networkName,
        });

        if (steps) {
          arbitrages.push({ symbol, steps });
        }
      }
    }

    return arbitrages;
  }

  private async calculateForwardArbitrageSteps({
    withdrawExchange,
    withdrawExchangeOrderBook,
    depositExchange,
    depositExchangeOrderBook,
    symbol,
    baseCurrencyCode,
    quoteCurrencyCode,
    networkName,
  }: CalculateArbitrageStepsParams) {
    const firstTradeEndAmount = Math.min(
      withdrawExchangeOrderBook.bestAsk.base,
      depositExchangeOrderBook.bestBid.base
    );
    const firstTradePrice = withdrawExchangeOrderBook.bestAsk.quote;
    const firstTradeStartAmount = firstTradeEndAmount * firstTradePrice;

    const feeCalculator = new FeeCalculator();
    const { withdrawExchangeTradeFee, depositExchangeTradeFee, withdrawFee } =
      await feeCalculator.calculateFees({
        withdrawExchange: withdrawExchange,
        depositExchange: depositExchange,
        currencyCode: baseCurrencyCode,
        networkName,
        symbol,
      });
    const withdrawAmount = feeCalculator.deductFee(
      firstTradeEndAmount,
      withdrawExchangeTradeFee
    );
    const lastTradeStartAmount = feeCalculator.deductFee(
      withdrawAmount,
      withdrawFee
    );
    const lastTradePrice = depositExchangeOrderBook.bestBid.quote;
    const lastTradeEndAmount =
      depositExchangeOrderBook.bestBid.quote * lastTradeStartAmount;
    const finalAmount = feeCalculator.deductFee(
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
        price: firstTradePrice,
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
        price: lastTradePrice,
      },
      { event: ExchangeEvent.PAY_FEE, ...depositExchangeTradeFee },
      {
        event: ExchangeEvent.STATUS,
        coin: { amount: finalAmount, currencyCode: quoteCurrencyCode },
        profitPercent: this.getProfitOrLossPercent(
          firstTradeStartAmount,
          finalAmount
        ),
      },
    ];

    if (this.isArbitrageFeasible(firstTradeStartAmount, finalAmount)) {
      return steps;
    }

    return null;
  }

  private async calculateReverseArbitrageSteps({
    withdrawExchange,
    withdrawExchangeOrderBook,
    depositExchange,
    depositExchangeOrderBook,
    symbol,
    baseCurrencyCode,
    quoteCurrencyCode,
    networkName,
  }: CalculateArbitrageStepsParams) {
    const firstTradeStartAmount = Math.min(
      withdrawExchangeOrderBook.bestBid.base,
      depositExchangeOrderBook.bestAsk.base
    );
    const firstTradePrice = withdrawExchangeOrderBook.bestBid.quote;
    const firstTradeEndAmount =
      firstTradeStartAmount * withdrawExchangeOrderBook.bestBid.quote;

    const feeCalculator = new FeeCalculator();
    const { withdrawExchangeTradeFee, depositExchangeTradeFee, withdrawFee } =
      await feeCalculator.calculateFees({
        withdrawExchange,
        depositExchange,
        networkName,
        symbol,
        currencyCode: quoteCurrencyCode,
      });
    const withdrawAmount = feeCalculator.deductFee(
      firstTradeEndAmount,
      withdrawExchangeTradeFee
    );
    const lastTradeStartAmount = feeCalculator.deductFee(
      withdrawAmount,
      withdrawFee
    );
    const lastTradePrice = depositExchangeOrderBook.bestAsk.quote;
    const lastTradeEndAmount = lastTradeStartAmount / lastTradePrice;
    const finalAmount = feeCalculator.deductFee(
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
        price: firstTradePrice,
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
        price: lastTradePrice,
      },
      { event: ExchangeEvent.PAY_FEE, ...depositExchangeTradeFee },
      {
        event: ExchangeEvent.STATUS,
        coin: { amount: finalAmount, currencyCode: baseCurrencyCode },
        profitPercent: this.getProfitOrLossPercent(
          firstTradeStartAmount,
          finalAmount
        ),
      },
    ];

    if (this.isArbitrageFeasible(firstTradeStartAmount, finalAmount)) {
      return steps;
    }

    return null;
  }

  private isArbitrageFeasible(startAmount: number, endAmount: number) {
    return (
      this.getProfitOrLossPercent(startAmount, endAmount) >=
      this.minProfitPercent
    );
  }

  private getProfitOrLossPercent(startAmount: number, endAmount: number) {
    return ((endAmount - startAmount) * 100) / startAmount;
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
