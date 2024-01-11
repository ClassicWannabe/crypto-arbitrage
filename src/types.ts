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

export type Fee = {
  type: TrasnferOperation | TradeOperation;
  amount: number;
};

export type Quotation = {
  price: number;
  volume: number;
};

export type ArbitrageStep = {
  exchangeId: string;
  quotation: Quotation;
  operation: TradeOperation;
  amount: number;
  fees: Fee[];
};

export type ArbitrageData = {
  network: string;
  symbol: string;
  steps: ArbitrageStep[];
};
