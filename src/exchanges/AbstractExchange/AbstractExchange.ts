import { Exchange as CcxtExchange, NetworkError, RequestTimeout } from "ccxt";
import { isNil } from "lodash-es";
import { z } from "zod";

import { Exchange, Networks, OrderBook, Ticker } from "../types.js";
import {
  addressSchema,
  balanceSchema,
  currenciesSchema,
  currencySchema,
  marketSchema,
  marketsSchema,
  orderBookSchema,
  orderSchema,
  tickerSchema,
  transactionSchema,
} from "../schema.js";
import { FeeType } from "../../types.js";
import { logger } from "../../logger/logger.js";
import { retryOnError } from "../decorators.js";

export abstract class AbstractExchange implements Exchange {
  protected readonly exchange: CcxtExchange;
  private orderBooks: Record<string, OrderBook> = {};
  private tickers: Record<string, Ticker> = {};
  readonly id: string;

  constructor(exchange: CcxtExchange) {
    exchange.checkRequiredCredentials();
    this.exchange = exchange;
    this.id = exchange.id;
  }

  async reloadMarkets(): Promise<void> {
    await this.exchange.loadMarkets(true);
  }

  @retryOnError()
  async getMarkets() {
    const markets = await this.exchange.loadMarkets();

    return marketsSchema.parse(markets);
  }

  @retryOnError()
  async getMarket(symbol: string, isActive?: boolean) {
    const markets = await this.exchange.loadMarkets();
    const market = markets[symbol];

    if (!market) {
      return null;
    }

    const parsedMarket = marketSchema.parse(market);

    return this.getActiveOrInactiveItem(parsedMarket, isActive);
  }

  @retryOnError()
  async getCurrencies() {
    await this.exchange.loadMarkets();
    const currencies = this.exchange.currencies;

    return currenciesSchema.parse(currencies);
  }

  @retryOnError()
  async getCurrency(code: string, isActive?: boolean) {
    await this.exchange.loadMarkets();
    const currencies = this.exchange.currencies;
    const currency = currencies[code];

    if (!currency) {
      return null;
    }

    const parsedCurrency = currencySchema.parse(currency);

    return this.getActiveOrInactiveItem(parsedCurrency, isActive);
  }

  @retryOnError()
  async getNetworks(currencyCode: string, isActive?: boolean) {
    const currency = await this.getCurrency(currencyCode);

    if (!currency) {
      return {};
    }

    const networks = currency.networks;

    return Object.entries(networks).reduce<Networks>(
      (acc, [netoworkName, network]) => {
        const checkedNetwork = this.getActiveOrInactiveItem(network, isActive);
        if (!checkedNetwork) {
          return acc;
        }
        acc[netoworkName] = network;
        return acc;
      },
      {}
    );
  }

  protected getActiveOrInactiveItem<TItem extends { active?: boolean | null }>(
    item: TItem,
    shouldBeActive?: boolean
  ): TItem | null {
    if (isNil(item.active) || isNil(shouldBeActive)) {
      return item;
    }
    if (item.active === shouldBeActive) {
      return item;
    }
    return null;
  }

  @retryOnError()
  async getOrderBook(symbol: string, limit?: number) {
    const cachedOrderBook = this.orderBooks[symbol];

    if (cachedOrderBook) {
      return cachedOrderBook;
    }
    const orderBookLimit = limit ? this.getOrderBookLimit(limit) : undefined;

    const orderBook = await this.exchange.fetchOrderBook(
      symbol,
      orderBookLimit
    );

    const parsedOrderBook = orderBookSchema.parse(orderBook);
    const bestBid = parsedOrderBook.bids[0];
    const bestAsk = parsedOrderBook.asks[0];

    if (!bestBid || !bestAsk) {
      logger.debug(`No best ask and/or bid. ${this.exchange.id}`);
      return null;
    }
    const modifiedOrderBook = { ...parsedOrderBook, bestAsk, bestBid };

    this.orderBooks[symbol] = modifiedOrderBook;

    return modifiedOrderBook;
  }

  private getOrderBookLimit(limit: number) {
    if (limit < 20) {
      return 20;
    }
    return limit;
  }

  resetOrderBookCache() {
    this.orderBooks = {};
  }

  @retryOnError()
  async getTradingFee(symbol: string) {
    const market = await this.getMarket(symbol);

    if (!market) {
      return null;
    }

    const isPercentage = market.percentage;
    const fee = Math.max(market.taker, market.maker);

    if (isPercentage) {
      return { value: fee, type: FeeType.PERCENT };
    }
    return { value: fee, type: FeeType.FIXED };
  }

  @retryOnError()
  async getWithdrawFee(code: string, networkName?: string) {
    const currency = await this.getCurrency(code);
    const currencyFee = currency?.fee ?? null;

    if (isNil(networkName)) {
      return currencyFee ? { value: currencyFee, type: FeeType.FIXED } : null;
    }
    const network = currency?.networks[networkName];
    const fee = network?.fee ?? currencyFee;

    if (!fee) {
      return null;
    }

    return { value: fee, type: FeeType.FIXED };
  }

  @retryOnError()
  async getTicker(symbol: string) {
    const cachedTicker = this.tickers[symbol];

    if (cachedTicker) {
      return cachedTicker;
    }

    const ticker = await this.exchange.fetchTicker(symbol);

    return tickerSchema.parse(ticker);
  }

  resetTickerCache(): void {
    this.tickers = {};
  }

  @retryOnError()
  async getBalance() {
    const balance = await this.exchange.fetchBalance();

    return balanceSchema.parse(balance);
  }

  @retryOnError()
  async getOrder(id: string, symbol: string) {
    const order = await this.exchange.fetchOrder(id, symbol);

    return orderSchema.parse(order);
  }

  @retryOnError()
  async createLimitBuyOrder(symbol: string, amount: number, price: number) {
    const order = await this.exchange.createLimitBuyOrder(
      symbol,
      amount,
      price
    );

    return orderSchema.parse(order);
  }

  @retryOnError()
  async createLimitSellOrder(symbol: string, amount: number, price: number) {
    const order = await this.exchange.createLimitSellOrder(
      symbol,
      amount,
      price
    );

    return orderSchema.parse(order);
  }

  @retryOnError()
  async withdraw(currencyCode: string, amount: number, address: string) {
    const transaction = await this.exchange.withdraw(
      currencyCode,
      amount,
      address
    );

    return transactionSchema.parse(transaction);
  }

  @retryOnError()
  async getDeposits() {
    const deposits = await this.exchange.fetchDeposits();

    return transactionSchema.array().parse(deposits);
  }

  @retryOnError()
  async getDepositAddress(currencyCode: string) {
    const address = await this.exchange.fetchDepositAddress(currencyCode);

    return addressSchema.parse(address);
  }

  amountToPrecision(symbol: string, amount: number) {
    try {
      const formattedValue = this.exchange.amountToPrecision(symbol, amount);

      return z.number().parse(+formattedValue);
    } catch (e) {
      const error = e as Error;
      logger.warn(error.stack);
      logger.warn({ symbol, amount, exchange: this.exchange.id });
    }
    return amount;
  }

  priceToPrecision(symbol: string, price: number) {
    try {
      const formattedValue = this.exchange.priceToPrecision(symbol, price);

      return z.number().parse(+formattedValue);
    } catch (e) {
      const error = e as Error;
      logger.warn(error.stack);
      logger.warn({ symbol, price, exchange: this.exchange.id });
    }
    return price;
  }

  costToPrecision(symbol: string, cost: number) {
    try {
      const formattedValue = this.exchange.costToPrecision(symbol, cost);

      return z.number().parse(+formattedValue);
    } catch (e) {
      const error = e as Error;
      logger.warn(error.stack);
      logger.warn({ symbol, cost, exchange: this.exchange.id });
    }
    return cost;
  }

  // TODO: investigate results
  // currencyToPrecision(currencyCode: string, amount: number) {
  //   const formattedValue = this.exchange.currencyToPrecision(
  //     currencyCode,
  //     amount
  //   );

  //   return z.number().parse(formattedValue);
  // }
}
