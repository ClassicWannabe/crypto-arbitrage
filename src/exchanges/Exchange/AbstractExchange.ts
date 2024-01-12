import { Exchange as CcxtExchange } from "ccxt";
import { isNil } from "lodash";

import { Exchange, Networks, OrderBook } from "../types.js";
import {
  currenciesSchema,
  currencySchema,
  marketSchema,
  marketsSchema,
  orderBookSchema,
} from "../schema.js";
import { FeeType } from "../../types.js";

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

  async calculateTradingFee(symbol: string) {
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

  async calculateWithdrawFee(code: string, networkName?: string) {
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
