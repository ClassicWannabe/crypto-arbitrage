import { z } from "zod";
import {
  Currency as CcxtCurrency,
  Dictionary as CcxtDictionary,
  Market as CcxtMarket,
} from "ccxt";

import {
  marketSchema,
  marketsSchema,
  currencySchema,
  currenciesSchema,
  networkSchema,
  networksSchema,
  orderBookSchema,
  quotationSchema,
  tickerSchema,
  balanceSchema,
  orderSchema,
  transactionSchema,
  addressSchema,
  depositWithdrawFeeSchema,
} from "./schema.js";
import { Fee } from "../types.js";

export interface Exchange {
  readonly id: string;
  reloadMarkets(): Promise<void>;
  getMarkets(): Promise<Markets>;
  getRawMarkets(): Promise<CcxtMarket[]>;
  getMarket(symbol: string, isActive?: boolean): Promise<Market | null>;
  getCurrencies(): Promise<Currencies>;
  getRawCurrencies(): Promise<CcxtDictionary<CcxtCurrency>>;
  getCurrency(code: string, isActive?: boolean): Promise<Currency | null>;
  getNetworks(currencyCode: string, isActive?: boolean): Promise<Networks>;
  getOrderBook(symbol: string, limit?: number): Promise<OrderBook | null>;
  resetOrderBookCache(): void;
  getTradingFee(symbol: string): Promise<Fee | null>;
  getWithdrawFee(code: string, networkName?: string): Promise<Fee[]>;
  getTicker(symbol: string): Promise<Ticker>;
  resetTickerCache(): void;
  getBalance(): Promise<Balance>;
  getOrder(id: string, symbol: string): Promise<Order>;
  createLimitBuyOrder(
    symbol: string,
    amount: number,
    price: number
  ): Promise<Order>;
  createLimitSellOrder(
    symbol: string,
    amount: number,
    price: number
  ): Promise<Order>;
  withdraw(
    currencyCode: string,
    amount: number,
    address: string
  ): Promise<Transcation>;
  getDeposits(): Promise<Transcation[]>;
  getDepositAddress(currencyCode: string, params?: any): Promise<Address>;
  createDepositAddress(currencyCode: string, params?: any): Promise<Address>;
  amountToPrecision(symbol: string, amount: number): number;
  priceToPrecision(symbol: string, price: number): number;
  costToPrecision(symbol: string, cost: number): number;
  setRawMarkets(
    markets: CcxtMarket[],
    currencies: CcxtDictionary<CcxtCurrency>
  ): void;
  set rawCurrencies(currencies: CcxtDictionary<CcxtCurrency>);
  // currencyToPrecision(currencyCode: string, amount: number): number;
}

export type Market = z.infer<typeof marketSchema>;
export type Markets = z.infer<typeof marketsSchema>;
export type Currency = z.infer<typeof currencySchema>;
export type Currencies = z.infer<typeof currenciesSchema>;
export type Network = z.infer<typeof networkSchema>;
export type Networks = z.infer<typeof networksSchema>;
export type Quotation = z.infer<typeof quotationSchema>;
export type OrderBook = z.infer<typeof orderBookSchema> & {
  bestBid: Quotation;
  bestAsk: Quotation;
};
export type Ticker = z.infer<typeof tickerSchema>;
export type Balance = z.infer<typeof balanceSchema>;
export type Order = z.infer<typeof orderSchema>;
export type Transcation = z.infer<typeof transactionSchema>;
export type Address = z.infer<typeof addressSchema>;
export type DepositWithdrawFee = z.infer<typeof depositWithdrawFeeSchema>;

export enum ExchangeType {
  BINANCE = "binance",
  BYBIT = "bybit",
  GATEIO = "gateio",
  HTX = "htx",
  KUCOIN = "kucoin",
  MEXC = "mexc",
  OKX = "okx",
  BITGET = "bitget",
}
