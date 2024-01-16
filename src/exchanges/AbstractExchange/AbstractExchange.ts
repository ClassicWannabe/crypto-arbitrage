import { Exchange as CcxtExchange } from "ccxt";
import { isNil } from "lodash-es";

import { Exchange, Networks, OrderBook } from "../types.js";
import {
  currenciesSchema,
  currencySchema,
  marketSchema,
  marketsSchema,
  orderBookSchema,
} from "../schema.js";
import { FeeType } from "../../types.js";
import { logger } from "../../logger/logger.js";

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

  async getMarket(symbol: string, isActive?: boolean) {
    const markets = await this.exchange.loadMarkets();
    const market = markets[symbol];

    if (!market) {
      return null;
    }

    const parsedMarket = marketSchema.parse(market);

    return this.getActiveOrInactiveItem(parsedMarket, isActive);
  }

  async getCurrencies() {
    await this.exchange.loadMarkets();
    const currencies = this.exchange.currencies;

    return currenciesSchema.parse(currencies);
  }

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
}
