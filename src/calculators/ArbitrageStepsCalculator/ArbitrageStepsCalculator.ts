import {
  Currency,
  Exchange,
  Market,
  Network,
  OrderBook,
  Ticker,
} from "../../exchanges/types.js";
import {
  ArbitrageSteps,
  ExchangeEvent,
  Fee,
  TradeOperation,
  TradeStep,
  WithdrawStep,
} from "../../types.js";
import { FeeCalculator } from "../FeeCalculator/FeeCalculator.js";

type MarketDetails = {
  orderBook: OrderBook;
  marketData: Market;
  ticker: Ticker;
  exchange: Exchange;
  baseCurrency: Currency | null;
  quoteCurrency: Currency | null;
};
export type CalculateArbitrageStepsParams = {
  withdrawMarketDetails: MarketDetails;
  depositMarketDetails: MarketDetails;
  minProfitPercent: number;
};

type ExchangeNetworks = {
  withdrawNetwork: Network;
  depositNetwork: Network;
};

export enum ArbitrageCalculationType {
  FORWARD = "forward",
  REVERSE = "reverse",
}

type CalculateParams = ExchangeNetworks & {
  arbitrageCalculationType: ArbitrageCalculationType;
};

type CalculateFirstTradeStepParams = {
  withdrawMarketDetails: MarketDetails;
  depositMarketDetails: MarketDetails;
  arbitrageCalculationType: ArbitrageCalculationType;
};

type CalculateWithdrawStepParams = {
  withdrawMarketDetails: MarketDetails;
  depositMarketDetails: MarketDetails;
  networks: ExchangeNetworks;
  firstTradeEndAmount: number;
  withdrawExchangeTradeFee: Fee;
  arbitrageCalculationType: ArbitrageCalculationType;
};

type CalculateLastTradeStepParams = {
  depositMarketDetails: MarketDetails;
  withdrawAmount: number;
  withdrawFee: Fee;
  arbitrageCalculationType: ArbitrageCalculationType;
};

export class ArbitrageStepsCalculator {
  constructor(
    private readonly feeCalculator: FeeCalculator,
    private readonly params: CalculateArbitrageStepsParams
  ) {}

  async calculateArbitrageSteps({
    withdrawNetwork,
    depositNetwork,
    arbitrageCalculationType,
  }: CalculateParams): Promise<ArbitrageSteps | null> {
    const { withdrawMarketDetails, depositMarketDetails } = this.params;
    const { symbol } = withdrawMarketDetails.marketData;
    const networkName = withdrawNetwork.network;

    const firstTradeStep = this.calculateFirstTradeStep({
      depositMarketDetails,
      withdrawMarketDetails,
      arbitrageCalculationType,
    });
    const firstTradeEndAmount = firstTradeStep.endCoin.amount;
    const firstTradeStartAmount = firstTradeStep.startCoin.amount;

    const { withdrawExchangeTradeFee, depositExchangeTradeFee, withdrawFee } =
      await this.feeCalculator.calculateFees({
        withdrawExchange: withdrawMarketDetails.exchange,
        depositExchange: depositMarketDetails.exchange,
        currencyCode: withdrawMarketDetails.marketData.base,
        networkName,
        symbol,
      });

    const withdrawStep = this.calculateWithdrawStep({
      arbitrageCalculationType,
      firstTradeEndAmount,
      depositMarketDetails,
      withdrawMarketDetails,
      networks: { depositNetwork, withdrawNetwork },
      withdrawExchangeTradeFee,
    });

    const lastTradeStep = this.calculateLastTradeStep({
      arbitrageCalculationType,
      depositMarketDetails,
      withdrawAmount: withdrawStep.coin.amount,
      withdrawFee,
    });
    const lastTradeEndAmount = lastTradeStep.endCoin.amount;

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
        ...firstTradeStep,
        fee: withdrawExchangeTradeFee,
      },
      { event: ExchangeEvent.PAY_FEE, ...withdrawExchangeTradeFee },
      {
        ...withdrawStep,
        fee: withdrawFee,
      },
      { event: ExchangeEvent.PAY_FEE, ...withdrawFee },
      {
        ...lastTradeStep,
        fee: depositExchangeTradeFee,
      },
      { event: ExchangeEvent.PAY_FEE, ...depositExchangeTradeFee },
      {
        event: ExchangeEvent.STATUS,
        coin: {
          ...lastTradeStep.endCoin,
          amount: finalAmount,
        },
        profit: profitOrLoss,
      },
    ];

    if (this.isArbitrageFeasible(firstTradeStartAmount, finalAmount)) {
      return steps;
    }

    return null;
  }

  private calculateFirstTradeStep({
    withdrawMarketDetails,
    depositMarketDetails,
    arbitrageCalculationType: arbitrageType,
  }: CalculateFirstTradeStepParams): Omit<TradeStep, "fee"> {
    const operation =
      arbitrageType === ArbitrageCalculationType.FORWARD
        ? TradeOperation.BUY
        : TradeOperation.SELL;
    let firstTradeEndAmount: number;
    let firstTradePrice: number;
    let firstTradeStartAmount: number;

    if (arbitrageType === ArbitrageCalculationType.FORWARD) {
      firstTradeEndAmount = Math.min(
        withdrawMarketDetails.orderBook.bestAsk.base,
        depositMarketDetails.orderBook.bestBid.base
      ); // base currency
      firstTradePrice = withdrawMarketDetails.orderBook.bestAsk.quote;
      firstTradeStartAmount = firstTradeEndAmount * firstTradePrice; // quote currency
    } else {
      firstTradeStartAmount = Math.min(
        withdrawMarketDetails.orderBook.bestBid.base,
        depositMarketDetails.orderBook.bestAsk.base
      ); // base currency
      firstTradePrice = withdrawMarketDetails.orderBook.bestBid.quote;
      firstTradeEndAmount = firstTradeStartAmount * firstTradePrice; // quote currency
    }

    return {
      event: ExchangeEvent.TRADE,
      exchangeId: withdrawMarketDetails.exchange.id,
      operation,
      startCoin: {
        amount: firstTradeStartAmount,
        currencyCode:
          withdrawMarketDetails.quoteCurrency?.code ??
          withdrawMarketDetails.marketData.quote,
        currencyName: withdrawMarketDetails.quoteCurrency?.name,
      },
      endCoin: {
        amount: firstTradeEndAmount,
        currencyCode:
          withdrawMarketDetails.baseCurrency?.code ??
          withdrawMarketDetails.marketData.base,
        currencyName: withdrawMarketDetails.baseCurrency?.name,
      },
      price: firstTradePrice,
      amount: firstTradeEndAmount,
      orderBook: withdrawMarketDetails.orderBook,
      dayChangePercentage: withdrawMarketDetails.ticker.percentage,
      isActive: withdrawMarketDetails.marketData.active,
    };
  }

  private calculateWithdrawStep({
    arbitrageCalculationType: arbitrageType,
    depositMarketDetails,
    withdrawMarketDetails,
    firstTradeEndAmount,
    withdrawExchangeTradeFee,
    networks: { depositNetwork, withdrawNetwork },
  }: CalculateWithdrawStepParams): Omit<WithdrawStep, "fee"> {
    const withdrawCurrency: Pick<Currency, "code" | "name"> =
      arbitrageType === ArbitrageCalculationType.FORWARD
        ? {
            code: withdrawMarketDetails.marketData.base,
            ...withdrawMarketDetails.baseCurrency,
          }
        : {
            code: withdrawMarketDetails.marketData.quote,
            ...withdrawMarketDetails.quoteCurrency,
          };
    const rawWithdrawAmount = this.feeCalculator.deductFee(
      firstTradeEndAmount,
      withdrawExchangeTradeFee
    );
    const withdrawAmount = rawWithdrawAmount;

    return {
      event: ExchangeEvent.WITHDRAW,
      network: {
        name: withdrawNetwork.network,
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
        withdrawExchangeId: withdrawMarketDetails.exchange.id,
        depositExchangeId: depositMarketDetails.exchange.id,
      },
      coin: {
        amount: withdrawAmount,
        currencyCode: withdrawCurrency.code,
        currencyName: withdrawCurrency?.name,
      },
    };
  }

  private calculateLastTradeStep({
    arbitrageCalculationType: arbitrageType,
    depositMarketDetails,
    withdrawAmount,
    withdrawFee,
  }: CalculateLastTradeStepParams): Omit<TradeStep, "fee"> {
    const symbol = depositMarketDetails.marketData.symbol;
    const rawLastTradeStartAmount = this.feeCalculator.deductFee(
      withdrawAmount,
      withdrawFee
    );

    let operation: TradeOperation;
    let lastTradeStartAmount: number;
    let lastTradePrice: number;
    let lastTradeEndAmount: number;
    if (arbitrageType === ArbitrageCalculationType.FORWARD) {
      operation = TradeOperation.SELL;
      lastTradeStartAmount = depositMarketDetails.exchange.amountToPrecision(
        symbol,
        rawLastTradeStartAmount
      ); // base currency
      lastTradePrice = depositMarketDetails.orderBook.bestBid.quote;
      lastTradeEndAmount = lastTradePrice * lastTradeStartAmount; // quote currency
    } else {
      operation = TradeOperation.BUY;
      lastTradeStartAmount = rawLastTradeStartAmount; // quote currency
      lastTradePrice = depositMarketDetails.orderBook.bestAsk.quote;
      const rawLastTradeEndAmount = lastTradeStartAmount / lastTradePrice;
      lastTradeEndAmount = depositMarketDetails.exchange.amountToPrecision(
        symbol,
        rawLastTradeEndAmount
      ); // base currency
    }

    return {
      event: ExchangeEvent.TRADE,
      operation,
      exchangeId: depositMarketDetails.exchange.id,
      startCoin: {
        amount: lastTradeStartAmount,
        currencyCode:
          depositMarketDetails.baseCurrency?.code ??
          depositMarketDetails.marketData.base,
        currencyName: depositMarketDetails.baseCurrency?.name,
      },
      endCoin: {
        amount: lastTradeEndAmount,
        currencyCode:
          depositMarketDetails.quoteCurrency?.code ??
          depositMarketDetails.marketData.quote,
        currencyName: depositMarketDetails.quoteCurrency?.name,
      },
      price: lastTradePrice,
      amount: lastTradeStartAmount,
      orderBook: depositMarketDetails.orderBook,
      dayChangePercentage: depositMarketDetails.ticker.percentage,
      isActive: depositMarketDetails.marketData.active,
    };
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
