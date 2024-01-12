import {
  ArbitrageData,
  ArbitrageStep,
  ArbitrageSteps,
  ExchangeEvent,
  FeeTemp,
  FeeType,
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

type ArbitrageCalculationExchangeData = {
  exchange: Exchange;
  bestBidOrAsk: Quotation;
};

type ArbitrageCalculationParams = {
  symbol: string;
  transferCurrency: Currency;
  buyExchange: ArbitrageCalculationExchangeData;
  sellExchange: ArbitrageCalculationExchangeData;
};

type ProfitableArbitrageResult = {
  fees: FeeTemp[];
  amount: number;
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
    const exchangePairs = this.getExchangePermutations();
    const arbitrages: ArbitrageData[] = [];
    for (const [exchangeOne, exchangeTwo] of exchangePairs) {
      const [exchangeOneMarketData, exchangeTwoMarketData] = await Promise.all([
        exchangeOne.getMarket(symbol, true),
        exchangeTwo.getMarket(symbol, true),
      ]);

      if (!exchangeOneMarketData || !exchangeTwoMarketData) {
        logger.debug(
          `Missing active market data ${exchangeOne.id}-${exchangeTwo.id}`
        );
        continue;
      }

      const baseCurrencyCode = exchangeOneMarketData.base;
      const quoteCurrencyCode = exchangeOneMarketData.quote;

      const [baseCurrencyCommonNetworks, quoteCurrencyCommonNetworks] =
        await Promise.all([
          this.getCommonActiveNetworkNames(
            [exchangeOne, exchangeTwo],
            baseCurrencyCode
          ),
          this.getCommonActiveNetworkNames(
            [exchangeTwo, exchangeOne],
            quoteCurrencyCode
          ),
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
        exchangeOne.getCurrency(baseCurrencyCode, true),
        exchangeOne.getCurrency(quoteCurrencyCode, true),
        exchangeTwo.getCurrency(baseCurrencyCode, true),
        exchangeTwo.getCurrency(quoteCurrencyCode, true),
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

      if (!exchangeOneOrderBook || !exchangeTwoOrderBook) {
        logger.debug(
          `Missing order books ${exchangeOne.id}-${exchangeTwo.id}. Symbol: ${symbol}`
        );
        continue;
      }

      const emptyFee = { type: FeeType.FIXED, value: 0 };
      const baseAmount = Math.min(
        exchangeOneOrderBook.bestAsk.volume,
        exchangeTwoOrderBook.bestBid.volume
      );
      const quoteAmount = baseAmount * exchangeOneOrderBook.bestAsk.price;
      const buyFee =
        (await exchangeOne.calculateTradingFee(symbol)) ?? emptyFee;
      const sellFee =
        (await exchangeTwo.calculateTradingFee(symbol)) ?? emptyFee;
      const networkName = baseCurrencyCommonNetworks[0]!;
      const withdrawFee =
        (await exchangeOne.calculateWithdrawFee(
          baseCurrencyCode,
          baseCurrencyCommonNetworks[0]
        )) ?? emptyFee;

      const steps: ArbitrageSteps = [
        {
          event: ExchangeEvent.FIRST_TRADE,
          exchangeId: exchangeOne.id,
          operation: TradeOperation.BUY,
          base: { amount: baseAmount, currencyCode: baseCurrencyCode },
          quote: {
            amount: quoteAmount,
            currencyCode: quoteCurrencyCode,
          },
        },
        { event: ExchangeEvent.PAY_FEE, ...buyFee },
        {
          event: ExchangeEvent.WITHDRAW,
          network: networkName,
        },
        { event: ExchangeEvent.PAY_FEE, ...withdrawFee },
        {
          event: ExchangeEvent.LAST_TRADE,
          operation: TradeOperation.SELL,
          exchangeId: exchangeTwo.id,
          coin: {
            amount: exchangeTwoOrderBook.bestBid.price,
            currencyCode: quoteCurrencyCode,
          },
        },
        { event: ExchangeEvent.PAY_FEE, ...sellFee },
      ];

      const profitOrLossPercent = this.calculateStepsProfitOrLossPercent(steps);
      if (this.isArbitrageFeasible(profitOrLossPercent)) {
      }

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
          transferCurrency: exchangeOneQuoteCurrency,
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
          networks: quoteCurrencyCommonNetworks,
          steps: [
            {
              exchangeId: exchangeOne.id,
              bestAsk: exchangeOneOrderBook.bestAsk,
              bestBid: exchangeOneOrderBook.bestBid,
              operation: TradeOperation.SELL,
              price: exchangeOneOrderBook.bestBid.price,
            },
            {
              exchangeId: exchangeTwo.id,
              bestAsk: exchangeTwoOrderBook.bestAsk,
              bestBid: exchangeTwoOrderBook.bestBid,
              operation: TradeOperation.BUY,
              price: exchangeTwoOrderBook.bestAsk.price,
            },
          ],
        });
      }
    }

    return arbitrages;
  }

  private calculateStepsProfitOrLossPercent(steps: ArbitrageSteps): number {
    let initialAmount = 0;
    let stepAmount = 0;
    for (const step of steps) {
      switch (step.event) {
        case ExchangeEvent.FIRST_TRADE: {
          if (step.operation === TradeOperation.BUY) {
            initialAmount = step.quote.amount;
            stepAmount = step.base.amount;
          } else {
            initialAmount = step.base.amount;
            stepAmount = step.quote.amount;
          }
          break;
        }
        case ExchangeEvent.PAY_FEE: {
          if (step.type === FeeType.PERCENT) {
            stepAmount -= stepAmount * step.value;
          } else {
            stepAmount -= step.value;
          }
          break;
        }
        case ExchangeEvent.LAST_TRADE: {
          stepAmount *= step.coin.amount;
        }
      }
    }
    return (stepAmount - initialAmount) / initialAmount;
  }

  private isArbitrageFeasible(profitOrLossPercent: number) {
    return profitOrLossPercent >= this.minProfitPercent;
  }

  private async calculateArbitrageProfitability({
    symbol,
    transferCurrency,
    buyExchange: { exchange: buyExchange, bestBidOrAsk: buyQuotation },
    sellExchange: { exchange: sellExchange, bestBidOrAsk: sellQuotation },
  }: ArbitrageCalculationParams): Promise<ProfitableArbitrageResult | null> {
    const profitOrLoss = sellQuotation.price - buyQuotation.price;
    const profitOrLossPercent = (profitOrLoss / buyQuotation.price) * 100;
    // if (profitOrLossPercent < this.minProfitPercent) {
    //   return null;
    // }
    console.log(transferCurrency);
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

  private swapMarket(
    exchange: Exchange,
    operation: TradeOperation,
    bestAskOrBid: Quotation
  ) {
    const amount = Math.min(exchange1bestAsk.volume, exchange2bestBid.volume);
    const price = exchange1bestAsk.price;
    const fee = exchange1.calculateTradingFee(symbol, amount);

    return { amount, price, fee };
  }

  private buyMarket() {
    const amount = Math.min(exchange1bestAsk.volume, exchange2bestBid.volume);
    const price = exchange1bestAsk.price;
    const fee = exchange1.calculateTradingFee(symbol, amount);

    return { amount, price, fee };
  }

  private async withdrawCurrency({
    transferCurrencyCode,
    network,
    exchange,
  }: {
    exchange: Exchange;
    transferCurrencyCode: string;
    network: string;
  }) {
    const fee = await exchange.calculateWithdrawFee(
      transferCurrencyCode,
      network
    );

    return { fee };
  }

  private sellMarket() {
    const price = exchange2bestAsk.price;
    const fee = exchange2.calculateTradingFee(symbol, price);
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
  }): Promise<FeeTemp[]> {
    const [buyExchange, sellExchange] = exchangePair;
    const [buyExchangeTradingFee, sellExchangeTradingFee, withdrawalFee] =
      await Promise.all([
        buyExchange.calculateTradingFee(symbol, amount),
        sellExchange.calculateTradingFee(symbol, amount),
        buyExchange.calculateWithdrawFee(transferCurrencyCode),
      ]);

    const fees: FeeTemp[] = [];

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
