export enum TrasnferOperation {
  DEPOSIT = "deposit",
  WITHDRAW = "withdraw",
}

export enum TradeOperation {
  BUY = "buy",
  SELL = "sell",
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
  amount: number;
};

export type StatusStep = {
  event: ExchangeEvent.STATUS;
  coin: CurrencyAmount;
};

export type TradeStep = {
  event: ExchangeEvent.TRADE;
  operation: TradeOperation;
  startCoin: CurrencyAmount;
  endCoin: CurrencyAmount;
  exchangeId: string;
};

export type FeeStep = Pick<Fee, "type" | "value"> & {
  event: ExchangeEvent.PAY_FEE;
};

export type WithdrawStep = {
  event: ExchangeEvent.WITHDRAW;
  network: string;
  coin: CurrencyAmount;
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
