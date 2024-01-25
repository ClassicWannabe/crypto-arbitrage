import { Exchange, Market, OrderBook, Ticker } from "../../exchanges/types.js";
import { ArbitrageSteps, ExchangeEvent, TradeOperation } from "../../types.js";
import { FeeCalculator } from "../FeeCalculator/FeeCalculator.js";

export type CalculateArbitrageStepsParams = {
  withdrawExchangeOrderBook: OrderBook;
  depositExchangeOrderBook: OrderBook;
  withdrawExchangeTicker: Ticker;
  depositExchangeTicker: Ticker;
  withdrawExchange: Exchange;
  depositExchange: Exchange;
  market: Market;
  minProfitPercent: number;
};

export class ArbitrageStepsCalculator {
  constructor(
    private readonly feeCalculator: FeeCalculator,
    private readonly params: CalculateArbitrageStepsParams
  ) {}

  async calculateForwardArbitrageSteps(
    networkName: string
  ): Promise<ArbitrageSteps | null> {
    const {
      withdrawExchange,
      depositExchange,
      withdrawExchangeOrderBook,
      depositExchangeOrderBook,
      withdrawExchangeTicker,
      depositExchangeTicker,
      market,
    } = this.params;
    const { symbol, base: baseCurrencyCode, quote: quoteCurrencyCode } = market;
    const firstTradeEndAmount = Math.min(
      withdrawExchangeOrderBook.bestAsk.base,
      depositExchangeOrderBook.bestBid.base
    );
    const firstTradePrice = withdrawExchangeOrderBook.bestAsk.quote;
    const firstTradeStartAmount = firstTradeEndAmount * firstTradePrice;

    const { withdrawExchangeTradeFee, depositExchangeTradeFee, withdrawFee } =
      await this.feeCalculator.calculateFees({
        withdrawExchange: withdrawExchange,
        depositExchange: depositExchange,
        currencyCode: baseCurrencyCode,
        networkName,
        symbol,
      });
    const withdrawAmount = this.feeCalculator.deductFee(
      firstTradeEndAmount,
      withdrawExchangeTradeFee
    );
    const lastTradeStartAmount = this.feeCalculator.deductFee(
      withdrawAmount,
      withdrawFee
    );
    const lastTradePrice = depositExchangeOrderBook.bestBid.quote;
    const lastTradeEndAmount =
      depositExchangeOrderBook.bestBid.quote * lastTradeStartAmount;
    const finalAmount = this.feeCalculator.deductFee(
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
        orderBook: withdrawExchangeOrderBook,
        dayChangePercentage: withdrawExchangeTicker.percentage,
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
        orderBook: depositExchangeOrderBook,
        dayChangePercentage: depositExchangeTicker.percentage,
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

  async calculateReverseArbitrageSteps(
    networkName: string
  ): Promise<ArbitrageSteps | null> {
    const {
      withdrawExchange,
      depositExchange,
      withdrawExchangeOrderBook,
      depositExchangeOrderBook,
      withdrawExchangeTicker,
      depositExchangeTicker,
      market,
    } = this.params;
    const { symbol, base: baseCurrencyCode, quote: quoteCurrencyCode } = market;
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
        orderBook: withdrawExchangeOrderBook,
        dayChangePercentage: withdrawExchangeTicker.percentage,
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
        orderBook: depositExchangeOrderBook,
        dayChangePercentage: depositExchangeTicker.percentage,
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
      this.params.minProfitPercent
    );
  }

  private getProfitOrLossPercent(startAmount: number, endAmount: number) {
    return ((endAmount - startAmount) * 100) / startAmount;
  }
}
