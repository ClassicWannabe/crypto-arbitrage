export type Coin = {
    id: string;
    symbol: string;
}

export type CoinPair = {
    baseCoin: Coin;
    quoteCoin: Coin;
    swapPrice: number;
}