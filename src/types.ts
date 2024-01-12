export type Coin = {
  id: string;
  symbol: string;
};

export type CoinPair = {
  baseCoin: Coin;
  quoteCoin: Coin;
  swapPrice: number;
};

export type TriangularCoinPair = {
  firstPair: CoinPair;
  secondPair: CoinPair;
  thirdPair: CoinPair;
};

export enum TrasnferOperation {
  DEPOSIT = "deposit",
  WITHDRAW = "withdraw",
}

export enum TradeOperation {
  BUY = "buy",
  SELL = "sell",
}

export type TransferFee = {
  type: TrasnferOperation;
  amount: number;
  network: string;
};

export type TradeFee = {
  type: TradeOperation;
  amount: number;
};

export type FeeTemp = TransferFee | TradeFee;

export enum FeeType {
  FIXED = "fixed",
  PERCENT = "percent",
}

export type Fee = {
  value: number;
  type: FeeType;
};

export type Quotation = {
  price: number;
  volume: number;
};

export type ArbitrageStep = {
  exchangeId: string;
  bestBid: Quotation;
  bestAsk: Quotation;
  operation: TradeOperation;
  price: number;
};

export type ArbitrageData = {
  networks: string[];
  symbol: string;
  fees: FeeTemp[];
  amount: number;
  steps: ArbitrageStep[];
};

export enum ExchangeEvent {
  FIRST_TRADE = "firstTrade",
  LAST_TRADE = "lastTrade",
  PAY_FEE = "payFee",
  WITHDRAW = "withdraw",
}

type CurrencyAmount = {
  currencyCode: string;
  amount: number;
};

export type FirstTradeStep = {
  event: ExchangeEvent.FIRST_TRADE;
  operation: TradeOperation;
  base: CurrencyAmount;
  quote: CurrencyAmount;
  exchangeId: string;
};

export type LastTradeStep = {
  event: ExchangeEvent.LAST_TRADE;
  operation: TradeOperation;
  coin: CurrencyAmount;
  exchangeId: string;
};

export type FeeStep = Pick<Fee, "type" | "value"> & {
  event: ExchangeEvent.PAY_FEE;
};

export type WithdrawStep = {
  event: ExchangeEvent.WITHDRAW;
  network: string;
};

export type ArbitrageSteps =
  | [FirstTradeStep, FeeStep, WithdrawStep, FeeStep, LastTradeStep, FeeStep]
  | [FirstTradeStep, FeeStep, WithdrawStep, FeeStep, LastTradeStep, FeeStep];
