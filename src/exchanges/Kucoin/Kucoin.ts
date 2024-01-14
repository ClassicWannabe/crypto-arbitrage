import { kucoin } from "ccxt";

import { AbstractExchange } from "../AbstractExchange/AbstractExchange.js";
import { kucoinCurrencySchema, kucoinCurrenciesSchema } from "./schema.js";

export class Kucoin extends AbstractExchange {
  constructor(exchange: kucoin) {
    super(exchange);
  }

  async getCurrencies() {
    await this.exchange.loadMarkets();
    const currencies = this.exchange.currencies;

    return kucoinCurrenciesSchema.parse(currencies);
  }

  async getCurrency(code: string, isActive?: boolean) {
    await this.exchange.loadMarkets();
    const currencies = this.exchange.currencies;
    const currency = currencies[code];

    if (!currency) {
      return null;
    }

    const parsedCurrency = kucoinCurrencySchema.parse(currency);

    return this.getActiveOrInactiveItem(parsedCurrency, isActive);
  }
}
