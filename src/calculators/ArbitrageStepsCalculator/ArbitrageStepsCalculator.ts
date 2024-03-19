import { mean, sum } from "lodash-es";

import {
  Currency,
  Exchange,
  Market,
  Network,
  OrderBook,
  Quotation,
  Ticker,
} from "../../exchanges/types.js";
import { logger } from "../../logger/logger.js";
import {
  ArbitrageSteps,
  ExchangeEvent,
  Fee,
  TradeOperation,
  TradeStep,
  WithdrawStep,
} from "../../types.js";
import {
  CalculatedFeeType,
  FeeCalculator,
} from "../FeeCalculator/FeeCalculator.js";
import { AddressCalculator } from "../AddressCalculator/AddressCalculator.js";

type MarketDetails = {
  orderBook: OrderBook;
  marketData: Market;
  ticker: Ticker;
  exchange: Exchange;
  network: Network;
  baseCurrency: Currency | null;
  quoteCurrency: Currency | null;
};
export type CalculateArbitrageStepsParams = {
  withdrawMarketDetails: MarketDetails;
  depositMarketDetails: MarketDetails;
  arbitrageCalculationType: ArbitrageCalculationType;
};

type ExchangeNetworks = {
  withdrawNetwork: Network;
  depositNetwork: Network;
};

export enum ArbitrageCalculationType {
  FORWARD = "forward",
  REVERSE = "reverse",
}

type CalculateFirstTradeStepParams = {
  withdrawMarketDetails: MarketDetails;
  depositMarketDetails: MarketDetails;
  withdrawOrderBookList: OrderBookList;
  depositOrderBookList: OrderBookList;
  arbitrageCalculationType: ArbitrageCalculationType;
};

type CalculateWithdrawStepParams = {
  withdrawMarketDetails: MarketDetails;
  depositMarketDetails: MarketDetails;
  networks: ExchangeNetworks;
  firstTradeEndAmount: number;
  withdrawExchangeTradeFee: Fee;
  arbitrageCalculationType: ArbitrageCalculationType;
  depositAddress: string;
};

type CalculateLastTradeStepParams = {
  depositMarketDetails: MarketDetails;
  depositOrderBookList: OrderBookList;
  withdrawAmount: number;
  withdrawFee: Fee;
  arbitrageCalculationType: ArbitrageCalculationType;
};

type OrderBookList = {
  quotations: Quotation[];
  type: "asks" | "bids";
};

export class ArbitrageStepsCalculator {
  private minProfitPercent = 0;

  constructor(
    private readonly feeCalculator: FeeCalculator,
    private readonly addressCalculator: AddressCalculator,
    minProfitPercent: number = 0
  ) {
    this.checkMinProfitPercent(minProfitPercent);
    this.minProfitPercent = minProfitPercent;
  }

  setMinProfitPercent(minProfitPercent: number) {
    this.checkMinProfitPercent(minProfitPercent);
    this.minProfitPercent = minProfitPercent;
  }

  private checkMinProfitPercent(minProfitPercent: number) {
    if (minProfitPercent < 0) {
      throw new Error(
        `${ArbitrageStepsCalculator.name}: You need to provide non-negative prtofit percent`
      );
    }
  }

  async calculateArbitrageSteps({
    withdrawMarketDetails,
    depositMarketDetails,
    arbitrageCalculationType,
  }: CalculateArbitrageStepsParams): Promise<ArbitrageSteps | null> {
    const { symbol } = withdrawMarketDetails.marketData;
    const networkName = withdrawMarketDetails.network.network;
    const withdrawCurrency = this.getWithdrawCurrency(
      arbitrageCalculationType,
      withdrawMarketDetails
    );
    const [withdrawExchangeTradeFee, depositExchangeTradeFee, withdrawFee] =
      await Promise.all([
        this.feeCalculator.calculateFee({
          type: CalculatedFeeType.TRADE,
          exchange: withdrawMarketDetails.exchange,
          symbol,
        }),
        this.feeCalculator.calculateFee({
          type: CalculatedFeeType.TRADE,
          exchange: depositMarketDetails.exchange,
          symbol,
        }),
        this.feeCalculator.calculateFee({
          type: CalculatedFeeType.WITHDRAW,
          exchange: withdrawMarketDetails.exchange,
          currencyCode: withdrawCurrency.code,
          networkName,
        }),
      ]);
    const depositAddress = await this.addressCalculator.getAddress({
      currencyCode: withdrawCurrency.code,
      exchange: depositMarketDetails.exchange,
      networkId: depositMarketDetails.network.network,
    });
    const { withdrawExchangeOrderBookList, depositExchangeOrderBookList } =
      this.getOrderBookLists({
        arbitrageCalculationType,
        withdrawExchangeOrderBook: withdrawMarketDetails.orderBook,
        depositExchangeOrderBook: depositMarketDetails.orderBook,
      });
    const withdrawQuotations = [
      withdrawExchangeOrderBookList.quotations.shift()!,
    ];
    const depositQuotations = [
      depositExchangeOrderBookList.quotations.shift()!,
    ];

    let feasibleArbitrageSteps: ArbitrageSteps | null = null;

    while (true) {
      const firstTradeStep = this.calculateFirstTradeStep({
        withdrawMarketDetails,
        depositMarketDetails,
        arbitrageCalculationType,
        withdrawOrderBookList: {
          ...withdrawExchangeOrderBookList,
          quotations: withdrawQuotations,
        },
        depositOrderBookList: {
          ...depositExchangeOrderBookList,
          quotations: depositQuotations,
        },
      });
      const firstTradeEndAmount = firstTradeStep.endCoin.amount;
      const firstTradeStartAmount = firstTradeStep.startCoin.amount;

      const withdrawStep = this.calculateWithdrawStep({
        arbitrageCalculationType,
        firstTradeEndAmount,
        depositMarketDetails,
        withdrawMarketDetails,
        networks: {
          depositNetwork: depositMarketDetails.network,
          withdrawNetwork: withdrawMarketDetails.network,
        },
        withdrawExchangeTradeFee,
        depositAddress,
      });

      const lastTradeStep = this.calculateLastTradeStep({
        arbitrageCalculationType,
        depositMarketDetails,
        depositOrderBookList: {
          ...depositExchangeOrderBookList,
          quotations: depositQuotations,
        },
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
        feasibleArbitrageSteps = steps;
      }

      const aggregatedWithdrawQuotation = this.roundAggregateQuotations(
        withdrawQuotations,
        withdrawMarketDetails.exchange,
        withdrawMarketDetails.marketData.symbol
      );
      const aggregatedDepositQuotation = this.roundAggregateQuotations(
        depositQuotations,
        depositMarketDetails.exchange,
        depositMarketDetails.marketData.symbol
      );
      if (aggregatedWithdrawQuotation.base <= aggregatedDepositQuotation.base) {
        const nextWithdrawQuotation =
          withdrawExchangeOrderBookList.quotations.shift();
        if (!nextWithdrawQuotation) {
          logger.debug({
            message: "Exhausted withdraw quotations",
            symbol,
            withdrawExchangeId: withdrawMarketDetails.exchange.id,
            depositExchangeId: depositMarketDetails.exchange.id,
          });
          break;
        }
        withdrawQuotations.push(nextWithdrawQuotation);
      } else {
        const nextDepositQuotation =
          depositExchangeOrderBookList.quotations.shift();
        if (!nextDepositQuotation) {
          logger.debug({
            message: "Exhausted deposit quotations",
            symbol,
            withdrawExchangeId: withdrawMarketDetails.exchange.id,
            depositExchangeId: depositMarketDetails.exchange.id,
          });
          break;
        }
        depositQuotations.push(nextDepositQuotation);
      }
    }

    return feasibleArbitrageSteps;
  }

  private getOrderBookLists({
    arbitrageCalculationType,
    withdrawExchangeOrderBook,
    depositExchangeOrderBook,
  }: {
    arbitrageCalculationType: ArbitrageCalculationType;
    withdrawExchangeOrderBook: OrderBook;
    depositExchangeOrderBook: OrderBook;
  }): {
    withdrawExchangeOrderBookList: OrderBookList;
    depositExchangeOrderBookList: OrderBookList;
  } {
    let withdrawExchangeOrderBookList: OrderBookList;
    let depositExchangeOrderBookList: OrderBookList;
    if (arbitrageCalculationType === ArbitrageCalculationType.FORWARD) {
      withdrawExchangeOrderBookList = {
        quotations: [...withdrawExchangeOrderBook.asks],
        type: "asks",
      };
      depositExchangeOrderBookList = {
        quotations: [...depositExchangeOrderBook.bids],
        type: "bids",
      };
    } else {
      withdrawExchangeOrderBookList = {
        quotations: [...withdrawExchangeOrderBook.bids],
        type: "bids",
      };
      depositExchangeOrderBookList = {
        quotations: [...depositExchangeOrderBook.asks],
        type: "asks",
      };
    }

    if (
      withdrawExchangeOrderBookList.quotations.length === 0 ||
      depositExchangeOrderBookList.quotations.length === 0
    ) {
      throw new Error(
        "One or both order books are empty. Symbol: " +
          withdrawExchangeOrderBook.symbol
      );
    }

    return { withdrawExchangeOrderBookList, depositExchangeOrderBookList };
  }

  private roundAggregateQuotations(
    quotations: Quotation[],
    exchange: Exchange,
    symbol: string
  ) {
    const aggregatedQuotation = this.aggregateQuotations(quotations);
    return this.roundQuotation(aggregatedQuotation, exchange, symbol);
  }

  private roundQuotation(
    quotation: Quotation,
    exchange: Exchange,
    symbol: string
  ): Quotation {
    return {
      base: exchange.amountToPrecision(symbol, quotation.base),
      quote: exchange.priceToPrecision(symbol, quotation.quote),
    };
  }

  private aggregateQuotations(quotations: Quotation[]): Quotation {
    const bases = quotations.map(({ base }) => base);
    const quotes = quotations.map(({ quote }) => quote);

    return {
      base: sum(bases),
      quote: mean(quotes),
    };
  }

  private calculateFirstTradeStep({
    withdrawMarketDetails,
    depositMarketDetails,
    arbitrageCalculationType,
    withdrawOrderBookList,
    depositOrderBookList,
  }: CalculateFirstTradeStepParams): Omit<TradeStep, "fee"> {
    const operation =
      arbitrageCalculationType === ArbitrageCalculationType.FORWARD
        ? TradeOperation.BUY
        : TradeOperation.SELL;
    const aggregatedWithdrawQuotation = this.roundAggregateQuotations(
      withdrawOrderBookList.quotations,
      withdrawMarketDetails.exchange,
      withdrawMarketDetails.marketData.symbol
    );
    const aggregatedDepositQuotation = this.roundAggregateQuotations(
      depositOrderBookList.quotations,
      depositMarketDetails.exchange,
      depositMarketDetails.marketData.symbol
    );
    const firstTradePrice = aggregatedWithdrawQuotation.quote;
    const lowestBaseSum = Math.min(
      aggregatedWithdrawQuotation.base,
      aggregatedDepositQuotation.base
    );
    let firstTradeEndAmount: number;
    let firstTradeStartAmount: number;

    if (arbitrageCalculationType === ArbitrageCalculationType.FORWARD) {
      firstTradeEndAmount = lowestBaseSum; // base currency
      firstTradeStartAmount = firstTradeEndAmount * firstTradePrice; // quote currency
    } else {
      firstTradeStartAmount = lowestBaseSum; // base currency
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
      amount: lowestBaseSum,
      usedQuotations: {
        length: withdrawOrderBookList.quotations.length,
        type: withdrawOrderBookList.type,
      },
      orderBook: withdrawMarketDetails.orderBook,
      dayChangePercentage: withdrawMarketDetails.ticker.percentage,
      isActive: withdrawMarketDetails.marketData.active,
    };
  }

  private calculateWithdrawStep({
    arbitrageCalculationType,
    depositMarketDetails,
    withdrawMarketDetails,
    firstTradeEndAmount,
    withdrawExchangeTradeFee,
    networks: { depositNetwork, withdrawNetwork },
    depositAddress,
  }: CalculateWithdrawStepParams): Omit<WithdrawStep, "fee"> {
    const withdrawCurrency = this.getWithdrawCurrency(
      arbitrageCalculationType,
      withdrawMarketDetails
    );
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
          address: depositAddress,
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

  private getWithdrawCurrency(
    arbitrageCalculationType: ArbitrageCalculationType,
    marketDetails: MarketDetails
  ): Pick<Currency, "code" | "name"> {
    return arbitrageCalculationType === ArbitrageCalculationType.FORWARD
      ? {
          code: marketDetails.marketData.base,
          name: marketDetails.baseCurrency?.name,
        }
      : {
          code: marketDetails.marketData.quote,
          name: marketDetails.quoteCurrency?.name,
        };
  }

  private calculateLastTradeStep({
    arbitrageCalculationType,
    depositMarketDetails,
    depositOrderBookList,
    withdrawAmount,
    withdrawFee,
  }: CalculateLastTradeStepParams): Omit<TradeStep, "fee"> {
    const symbol = depositMarketDetails.marketData.symbol;
    const aggregatedDepositQuotation = this.roundAggregateQuotations(
      depositOrderBookList.quotations,
      depositMarketDetails.exchange,
      depositMarketDetails.marketData.symbol
    );
    const rawLastTradeStartAmount = this.feeCalculator.deductFee(
      withdrawAmount,
      withdrawFee
    );

    const lastTradePrice = aggregatedDepositQuotation.quote;
    let operation: TradeOperation;
    let lastTradeStartAmount: number;
    let lastTradeEndAmount: number;
    let tradeAmount: number;
    if (arbitrageCalculationType === ArbitrageCalculationType.FORWARD) {
      operation = TradeOperation.SELL;
      lastTradeStartAmount = depositMarketDetails.exchange.amountToPrecision(
        symbol,
        rawLastTradeStartAmount
      ); // base currency
      tradeAmount = lastTradeStartAmount;
      lastTradeEndAmount = lastTradePrice * lastTradeStartAmount; // quote currency
    } else {
      operation = TradeOperation.BUY;
      lastTradeStartAmount = rawLastTradeStartAmount; // quote currency
      const rawLastTradeEndAmount = lastTradeStartAmount / lastTradePrice;
      lastTradeEndAmount = depositMarketDetails.exchange.amountToPrecision(
        symbol,
        rawLastTradeEndAmount
      ); // base currency
      tradeAmount = lastTradeEndAmount;
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
      amount: tradeAmount,
      usedQuotations: {
        length: depositOrderBookList.quotations.length,
        type: depositOrderBookList.type,
      },
      orderBook: depositMarketDetails.orderBook,
      dayChangePercentage: depositMarketDetails.ticker.percentage,
      isActive: depositMarketDetails.marketData.active,
    };
  }

  private isArbitrageFeasible(startAmount: number, endAmount: number) {
    const profitOrLoss = this.getProfitOrLoss(startAmount, endAmount);

    return profitOrLoss.percent >= this.minProfitPercent;
  }

  private getProfitOrLoss(startAmount: number, endAmount: number) {
    const profitOrLoss = endAmount - startAmount;
    const profitOrLossPercent = (profitOrLoss * 100) / startAmount;

    return { amount: profitOrLoss, percent: profitOrLossPercent };
  }
}
