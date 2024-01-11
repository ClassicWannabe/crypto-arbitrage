import { Exchange as CcxtExchange } from "ccxt";

import { Exchange, OrderBook } from "../types.js";
import {
  currenciesSchema,
  currencySchema,
  marketSchema,
  marketsSchema,
  orderBookSchema,
} from "../schema.js";

export abstract class AbstractExchange implements Exchange {
  protected readonly exchange: CcxtExchange;
  private orderBooks: Record<string, OrderBook> = {};
  readonly id: string;

  constructor(exchange: CcxtExchange) {
    exchange.checkRequiredCredentials();
    this.exchange = exchange;
    this.id = exchange.id;
  }

  async reloadMarkets(): Promise<void> {
    await this.exchange.loadMarkets(true);
  }

  async getMarkets() {
    const markets = await this.exchange.loadMarkets();

    return marketsSchema.parse(markets);
  }

  async getMarket(symbol: string) {
    const markets = await this.exchange.loadMarkets();
    const market = markets[symbol];

    if (!market) {
      return null;
    }

    return marketSchema.parse(market);
  }

  async getCurrencies() {
    await this.exchange.loadMarkets();
    const currencies = this.exchange.currencies;

    return currenciesSchema.parse(currencies);
  }

  async getCurrency(code: string) {
    await this.exchange.loadMarkets();
    const currencies = this.exchange.currencies;
    const currency = currencies[code];

    if (!currency) {
      return null;
    }

    return currencySchema.parse(currency);
  }

  async getOrderBook(symbol: string) {
    let orderBook = this.orderBooks[symbol];

    if (orderBook) {
      return orderBook;
    }

    try {
      orderBook = await this.exchange.fetchL2OrderBook(symbol);
    } catch (e) {
      console.error(e);
    }

    return orderBookSchema.parse(orderBook);
  }

  async calculateTradingFee(symbol: string, amount: number) {
    const market = await this.getMarket(symbol);

    if (!market) {
      return null;
    }

    const isPercentage = market.percentage;
    const fee = Math.max(market.taker, market.maker);

    if (isPercentage) {
      return amount * fee;
    }
    return fee;
  }

  async calculateWithdrawFee(code: string): Promise<number | null> {
    const currency = await this.getCurrency(code);

    if (currency?.fee) {
      return currency.fee;
    }

    return null;
  }
}
