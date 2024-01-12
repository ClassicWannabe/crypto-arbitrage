import { z } from "zod";

import {
  marketSchema,
  marketsSchema,
  currencySchema,
  currenciesSchema,
  networkSchema,
  networksSchema,
  orderBookSchema,
  quotationSchema,
} from "./schema.js";
import { Fee } from "../types.js";

export interface Exchange {
  readonly id: string;
  reloadMarkets(): Promise<void>;
  getMarkets(): Promise<Markets>;
  getMarket(symbol: string, isActive?: boolean): Promise<Market | null>;
  getCurrencies(): Promise<Currencies>;
  getCurrency(code: string, isActive?: boolean): Promise<Currency | null>;
  getNetworks(currencyCode: string, isActive?: boolean): Promise<Networks>;
  getOrderBook(symbol: string): Promise<OrderBook | null>;
  calculateTradingFee(symbol: string): Promise<Fee | null>;
  calculateWithdrawFee(
    code: string,
    networkName?: string
  ): Promise<Fee | null>;
}

export type Market = z.infer<typeof marketSchema>;
export type Markets = z.infer<typeof marketsSchema>;
export type Currency = z.infer<typeof currencySchema>;
export type Currencies = z.infer<typeof currenciesSchema>;
export type Network = z.infer<typeof networkSchema>;
export type Networks = z.infer<typeof networksSchema>;
export type OrderBook = z.infer<typeof orderBookSchema>;
export type Quotation = z.infer<typeof quotationSchema>;
