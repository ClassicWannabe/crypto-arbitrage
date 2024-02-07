import {
  Exchange,
  Market,
  Network,
  OrderBook,
  Ticker,
} from "../../exchanges/types.js";
import { ArbitrageSteps, ExchangeEvent, TradeOperation } from "../../types.js";
import { FeeCalculator } from "../FeeCalculator/FeeCalculator.js";

export type CalculateArbitrageStepsParams = {
  withdrawExchangeOrderBook: OrderBook;
  depositExchangeOrderBook: OrderBook;
  withdrawExchangeTicker: Ticker;
  depositExchangeTicker: Ticker;
  withdrawExchange: Exchange;
  depositExchange: Exchange;
  withdrawExchangeMarketData: Market;
  depositExchangeMarketData: Market;
  minProfitPercent: number;
};

type CalculateParams = {
  withdrawNetwork: Network;
  depositNetwork: Network;
};

export class ArbitrageStepsCalculator {
  constructor(
    private readonly feeCalculator: FeeCalculator,
    private readonly params: CalculateArbitrageStepsParams
  ) {}

  async calculateForwardArbitrageSteps({
    withdrawNetwork,
    depositNetwork,
  }: CalculateParams): Promise<ArbitrageSteps | null> {
    const {
      withdrawExchange,
      depositExchange,
      withdrawExchangeOrderBook,
      depositExchangeOrderBook,
      withdrawExchangeTicker,
      depositExchangeTicker,
      withdrawExchangeMarketData,
      depositExchangeMarketData,
    } = this.params;
    const {
      symbol,
      base: baseCurrencyCode,
      quote: quoteCurrencyCode,
    } = withdrawExchangeMarketData;
    const networkName = withdrawNetwork.network;

    const firstTradeEndAmount = Math.min(
      withdrawExchangeOrderBook.bestAsk.base,
      depositExchangeOrderBook.bestBid.base
    ); // base currency
    const firstTradePrice = withdrawExchangeOrderBook.bestAsk.quote;
    const firstTradeStartAmount = firstTradeEndAmount * firstTradePrice; // quote currency

    const { withdrawExchangeTradeFee, depositExchangeTradeFee, withdrawFee } =
      await this.feeCalculator.calculateFees({
        withdrawExchange: withdrawExchange,
        depositExchange: depositExchange,
        currencyCode: baseCurrencyCode,
        networkName,
        symbol,
      });
    const withdrawCurrencyCode = baseCurrencyCode;
    const rawWithdrawAmount = this.feeCalculator.deductFee(
      firstTradeEndAmount,
      withdrawExchangeTradeFee
    );
    const withdrawAmount = rawWithdrawAmount;
    const rawLastTradeStartAmount = this.feeCalculator.deductFee(
      withdrawAmount,
      withdrawFee
    );
    const lastTradeStartAmount = depositExchange.amountToPrecision(
      symbol,
      rawLastTradeStartAmount
    ); // base currency
    const lastTradePrice = depositExchangeOrderBook.bestBid.quote;
    const lastTradeEndAmount =
      depositExchangeOrderBook.bestBid.quote * lastTradeStartAmount; // quote currency
    const finalAmount = this.feeCalculator.deductFee(
      lastTradeEndAmount,
      depositExchangeTradeFee
    );
    const profitOrLoss = this.getProfitOrLoss(
      firstTradeStartAmount,
      finalAmount
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
        fee: withdrawExchangeTradeFee,
        orderBook: withdrawExchangeOrderBook,
        dayChangePercentage: withdrawExchangeTicker.percentage,
        isActive: withdrawExchangeMarketData.active,
      },
      { event: ExchangeEvent.PAY_FEE, ...withdrawExchangeTradeFee },
      {
        event: ExchangeEvent.WITHDRAW,
        network: {
          name: networkName,
          withdrawNetwork: {
            isActive: withdrawNetwork.active,
            isDepositable: withdrawNetwork.deposit,
            isWithdrawable: withdrawNetwork.withdraw,
          },
          depositNetwork: {
            isActive: depositNetwork.active,
            isDepositable: depositNetwork.deposit,
            isWithdrawable: depositNetwork.withdraw,
          },
        },
        exchanges: {
          withdrawExchangeId: withdrawExchange.id,
          depositExchangeId: depositExchange.id,
        },
        coin: {
          amount: withdrawAmount,
          currencyCode: withdrawCurrencyCode,
        },
        fee: withdrawFee,
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
        fee: depositExchangeTradeFee,
        orderBook: depositExchangeOrderBook,
        dayChangePercentage: depositExchangeTicker.percentage,
        isActive: depositExchangeMarketData.active,
      },
      { event: ExchangeEvent.PAY_FEE, ...depositExchangeTradeFee },
      {
        event: ExchangeEvent.STATUS,
        coin: { amount: finalAmount, currencyCode: quoteCurrencyCode },
        profit: profitOrLoss,
      },
    ];

    if (this.isArbitrageFeasible(firstTradeStartAmount, finalAmount)) {
      return steps;
    }

    return null;
  }

  async calculateReverseArbitrageSteps({
    withdrawNetwork,
    depositNetwork,
  }: CalculateParams): Promise<ArbitrageSteps | null> {
    const {
      withdrawExchange,
      depositExchange,
      withdrawExchangeOrderBook,
      depositExchangeOrderBook,
      withdrawExchangeTicker,
      depositExchangeTicker,
      withdrawExchangeMarketData,
      depositExchangeMarketData,
    } = this.params;
    const {
      symbol,
      base: baseCurrencyCode,
      quote: quoteCurrencyCode,
    } = withdrawExchangeMarketData;
    const networkName = withdrawNetwork.network;
    const firstTradeStartAmount = Math.min(
      withdrawExchangeOrderBook.bestBid.base,
      depositExchangeOrderBook.bestAsk.base
    ); // base currency
    const firstTradePrice = withdrawExchangeOrderBook.bestBid.quote;
    const firstTradeEndAmount = firstTradeStartAmount * firstTradePrice; // quote currency

    const { withdrawExchangeTradeFee, depositExchangeTradeFee, withdrawFee } =
      await this.feeCalculator.calculateFees({
        withdrawExchange,
        depositExchange,
        networkName,
        symbol,
        currencyCode: quoteCurrencyCode,
      });
    const withdrawAmount = this.feeCalculator.deductFee(
      firstTradeEndAmount,
      withdrawExchangeTradeFee
    );

    const lastTradeStartAmount = this.feeCalculator.deductFee(
      withdrawAmount,
      withdrawFee
    ); // quote currency
    const lastTradePrice = depositExchangeOrderBook.bestAsk.quote;
    const rawLastTradeEndAmount = lastTradeStartAmount / lastTradePrice;
    const lastTradeEndAmount = depositExchange.amountToPrecision(
      symbol,
      rawLastTradeEndAmount
    ); // base currency
    const finalAmount = this.feeCalculator.deductFee(
      lastTradeEndAmount,
      depositExchangeTradeFee
    );
    const profitOrLoss = this.getProfitOrLoss(
      firstTradeStartAmount,
      finalAmount
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
        fee: withdrawExchangeTradeFee,
        dayChangePercentage: withdrawExchangeTicker.percentage,
        isActive: withdrawExchangeMarketData.active,
      },
      { event: ExchangeEvent.PAY_FEE, ...withdrawExchangeTradeFee },
      {
        event: ExchangeEvent.WITHDRAW,
        network: {
          name: networkName,
          withdrawNetwork: {
            isActive: withdrawNetwork.active,
            isDepositable: withdrawNetwork.deposit,
            isWithdrawable: withdrawNetwork.withdraw,
          },
          depositNetwork: {
            isActive: depositNetwork.active,
            isDepositable: depositNetwork.deposit,
            isWithdrawable: depositNetwork.withdraw,
          },
        },
        exchanges: {
          withdrawExchangeId: withdrawExchange.id,
          depositExchangeId: depositExchange.id,
        },
        coin: {
          amount: withdrawAmount,
          currencyCode: quoteCurrencyCode,
        },
        fee: withdrawFee,
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
        fee: depositExchangeTradeFee,
        dayChangePercentage: depositExchangeTicker.percentage,
        isActive: depositExchangeMarketData.active,
      },
      { event: ExchangeEvent.PAY_FEE, ...depositExchangeTradeFee },
      {
        event: ExchangeEvent.STATUS,
        coin: { amount: finalAmount, currencyCode: baseCurrencyCode },
        profit: profitOrLoss,
      },
    ];

    if (this.isArbitrageFeasible(firstTradeStartAmount, finalAmount)) {
      return steps;
    }

    return null;
  }

  private isArbitrageFeasible(startAmount: number, endAmount: number) {
    const profitOrLoss = this.getProfitOrLoss(startAmount, endAmount);

    return profitOrLoss.percent >= this.params.minProfitPercent;
  }

  private getProfitOrLoss(startAmount: number, endAmount: number) {
    const profitOrLoss = endAmount - startAmount;
    const profitOrLossPercent = (profitOrLoss * 100) / startAmount;

    return { amount: profitOrLoss, percent: profitOrLossPercent };
  }
}
