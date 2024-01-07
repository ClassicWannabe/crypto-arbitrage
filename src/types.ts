export type Coin = {
    id: string;
    symbol: string;
}

export type CoinPair = {
    baseCoin: Coin;
    quoteCoin: Coin;
    swapPrice: number;
}

export type TriangularCoinPair = {
    firstPair: CoinPair;
    secondPair: CoinPair;
    thirdPair: CoinPair;
}

export interface Exchange {

}