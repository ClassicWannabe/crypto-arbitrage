import { OrderBook } from "./exchanges/types.js";

export enum TrasnferOperation {
  DEPOSIT = "deposit",
  WITHDRAW = "withdraw",
}

export enum TradeOperation {
  BUY = "buy",
  SELL = "sell",
}

export enum OrderStatus {
  OPEN = "open",
  CLOSED = "closed",
  CANCELED = "canceled",
  EXPIRED = "expired",
  REJECTED = "rejected",
}

export enum TransactionType {
  DEPOSIT = "deposit",
  WITHDRAWAL = "withdrawal",
  TRANSFER = "transfer",
}

export enum FeeType {
  FIXED = "fixed",
  PERCENT = "percent",
}

export type Fee = {
  value: number;
  type: FeeType;
};

export type ArbitrageData = {
  symbol: string;
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  steps: ArbitrageSteps;
};

export enum ExchangeEvent {
  STATUS = "status",
  TRADE = "trade",
  PAY_FEE = "payFee",
  WITHDRAW = "withdraw",
}

export type CurrencyAmount = {
  currencyCode: string;
  currencyName?: string;
  amount: number;
};

export type StatusStep = {
  event: ExchangeEvent.STATUS;
  coin: CurrencyAmount;
  profit: {
    percent: number;
    amount: number;
  };
};

export type TradeStep = {
  event: ExchangeEvent.TRADE;
  operation: TradeOperation;
  startCoin: CurrencyAmount;
  endCoin: CurrencyAmount;
  orderBook: OrderBook;
  price: number;
  amount: number;
  exchangeId: string;
  fee: Fee;
  dayChangePercentage?: number | null;
  isActive?: boolean;
};

export type FeeStep = Pick<Fee, "type" | "value"> & {
  event: ExchangeEvent.PAY_FEE;
};

export type WithdrawStepNetworkDetails = {
  isActive?: boolean | null;
  isWithdrawable?: boolean | null;
  isDepositable?: boolean | null;
};

export type WithdrawStep = {
  event: ExchangeEvent.WITHDRAW;
  network: {
    name: string;
    withdrawNetwork: WithdrawStepNetworkDetails;
    depositNetwork: WithdrawStepNetworkDetails;
  };
  exchanges: {
    withdrawExchangeId: string;
    depositExchangeId: string;
  };
  coin: CurrencyAmount;
  fee: Fee;
};

export type ArbitrageSteps = [
  TradeStep,
  FeeStep,
  WithdrawStep,
  FeeStep,
  TradeStep,
  FeeStep,
  StatusStep,
];

export enum NodeEnv {
  PROD = "prod",
  DEV = "dev",
}
