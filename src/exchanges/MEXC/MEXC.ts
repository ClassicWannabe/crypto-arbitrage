import { mexc } from "ccxt";

import { AbstractExchange } from "../AbstractExchange/AbstractExchange.js";
import { logger } from "../../logger/logger.js";
import { mexcOrderBookSchema } from "./schema.js";

export class MEXC extends AbstractExchange {
  constructor(exchange: mexc) {
    super(exchange);
  }

  async getOrderBook(symbol: string) {
    const cachedOrderBook = this.orderBooks[symbol];

    if (cachedOrderBook) {
      return cachedOrderBook;
    }

    const orderBook = await this.exchange.fetchOrderBook(symbol);

    const parsedOrderBook = mexcOrderBookSchema.parse(orderBook);
    const bestBid = parsedOrderBook.bids[0];
    const bestAsk = parsedOrderBook.asks[0];

    if (!bestBid || !bestAsk) {
      logger.debug(`No best ask and/or bid. ${this.exchange.id}`);
      return null;
    }

    return { ...parsedOrderBook, bestAsk, bestBid };
  }
}
