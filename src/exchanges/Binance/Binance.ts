import { binance } from "ccxt";

import { AbstractExchange } from "../Exchange/AbstractExchange.js";
import { currenciesSchema, currencySchema } from "./schema.js";

export class Binance extends AbstractExchange {
  constructor(exchange: binance) {
    super(exchange);
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

  async getCurrencies() {
    await this.exchange.loadMarkets();
    const currencies = this.exchange.currencies;

    return currenciesSchema.parse(currencies);
  }
}
