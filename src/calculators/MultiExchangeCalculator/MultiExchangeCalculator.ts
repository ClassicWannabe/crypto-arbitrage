import { ArbitrageData } from "../../types.js";
import { Exchange, Network } from "../../exchanges/types.js";
import { logger } from "../../logger/logger.js";
import { FeeCalculator } from "../FeeCalculator/FeeCalculator.js";
import { ArbitrageStepsCalculator } from "../ArbitrageStepsCalculator/ArbitrageStepsCalculator.js";

type ExchangePair = { withdrawExchange: Exchange; depositExchange: Exchange };

type NetworkPair = { withdrawNetwork: Network; depositNetwork: Network };

export class MultiExchangeCalculator {
  private readonly exchanges: Exchange[];
  private minProfitPercent = 0;

  constructor(
    exchanges: Exchange[],
    minProfitPercent = 0,
    private readonly targetCoins: string[] | null
  ) {
    this.checkExchanges(exchanges);
    this.checkMinProfitPercent(minProfitPercent);
    this.exchanges = exchanges;
    this.minProfitPercent = minProfitPercent;
  }

  async calculate(symbol: string): Promise<ArbitrageData[]> {
    return await this.getArbitrages(symbol);
  }

  async reloadAllExchanges() {
    await Promise.all(
      this.exchanges.map(async (exchange) => {
        await exchange.reloadMarkets();
      })
    );
  }

  setMinProfitPercent(minProfitPercent: number) {
    this.checkMinProfitPercent(minProfitPercent);
    this.minProfitPercent = minProfitPercent;
  }

  private checkExchanges(exchanges: Exchange[]) {
    if (exchanges.length < 2) {
      throw new Error(
        `${MultiExchangeCalculator.name}: You need to provide at least two exchanges`
      );
    }
  }

  private checkMinProfitPercent(minProfitPercent: number) {
    if (minProfitPercent < 0) {
      throw new Error(
        `${MultiExchangeCalculator.name}: You need to provide non-negative prtofit percent`
      );
    }
  }

  private async getArbitrages(symbol: string): Promise<ArbitrageData[]> {
    const exchangePairs = this.getExchangePermutations();
    const arbitrages: ArbitrageData[] = await this.calculateArbitrageData(
      exchangePairs,
      symbol
    );

    this.resetExchangeCaches();

    return arbitrages;
  }

  private resetExchangeCaches() {
    for (const exchange of this.exchanges) {
      exchange.resetOrderBookCache();
      exchange.resetTickerCache();
    }
  }

  private async calculateArbitrageData(
    exchangePairs: ExchangePair[],
    symbol: string
  ) {
    const arbitrages: ArbitrageData[] = [];
    for (const { withdrawExchange, depositExchange } of exchangePairs) {
      const initialData = await this.getInitialData({
        withdrawExchange,
        depositExchange,
        symbol,
      });
      if (!initialData) {
        continue;
      }

      const {
        withdrawExchangeMarketData,
        depositExchangeMarketData,
        withdrawExchangeOrderBook,
        depositExchangeOrderBook,
        baseCurrencyCommonNetworks,
        quoteCurrencyCommonNetworks,
        withdrawExchangeTicker,
        depositExchangeTicker,
      } = initialData;

      const feeCalculator = new FeeCalculator();
      const arbitrageStepsCalculator = new ArbitrageStepsCalculator(
        feeCalculator,
        {
          withdrawExchange,
          depositExchange,
          withdrawExchangeOrderBook,
          depositExchangeOrderBook,
          withdrawExchangeMarketData,
          depositExchangeMarketData,
          minProfitPercent: this.minProfitPercent,
          withdrawExchangeTicker,
          depositExchangeTicker,
        }
      );

      for (const networkPair of baseCurrencyCommonNetworks) {
        const steps =
          await arbitrageStepsCalculator.calculateForwardArbitrageSteps(
            networkPair
          );

        if (steps) {
          arbitrages.push({ symbol, steps });
        }
      }

      for (const networkPair of quoteCurrencyCommonNetworks) {
        const steps =
          await arbitrageStepsCalculator.calculateReverseArbitrageSteps(
            networkPair
          );

        if (steps) {
          arbitrages.push({ symbol, steps });
        }
      }
    }

    return arbitrages;
  }

  private async getInitialData({
    withdrawExchange,
    depositExchange,
    symbol,
  }: {
    withdrawExchange: Exchange;
    depositExchange: Exchange;
    symbol: string;
  }) {
    const [withdrawExchangeMarketData, depositExchangeMarketData] =
      await Promise.all([
        withdrawExchange.getMarket(symbol, true),
        depositExchange.getMarket(symbol, true),
      ]);

    if (!withdrawExchangeMarketData || !depositExchangeMarketData) {
      logger.debug(
        `Missing active market data ${withdrawExchange.id}-${depositExchange.id}`
      );
      return null;
    }

    const baseCurrencyCode = withdrawExchangeMarketData.base;
    const quoteCurrencyCode = withdrawExchangeMarketData.quote;

    let [baseCurrencyCommonNetworks, quoteCurrencyCommonNetworks] =
      await Promise.all([
        this.getCommonActiveNetworks(
          { withdrawExchange, depositExchange },
          baseCurrencyCode
        ),
        this.getCommonActiveNetworks(
          { depositExchange, withdrawExchange },
          quoteCurrencyCode
        ),
      ]);

    if (
      !baseCurrencyCommonNetworks.length &&
      !quoteCurrencyCommonNetworks.length
    ) {
      logger.debug(`Missing common active networks ${symbol}`);
      return null;
    }

    if (this.targetCoins) {
      const isBaseCurrencyIncluded =
        this.targetCoins.includes(baseCurrencyCode);
      const isQuoteCurrencyIncluded =
        this.targetCoins.includes(quoteCurrencyCode);
      if (!isBaseCurrencyIncluded && !isQuoteCurrencyIncluded) {
        logger.debug(`Market data is not part of the target coins ${symbol}`);
        return null;
      }

      const isAnyIncluded = isBaseCurrencyIncluded && isQuoteCurrencyIncluded;

      if (!isAnyIncluded && isBaseCurrencyIncluded) {
        baseCurrencyCommonNetworks = [];
      } else if (!isAnyIncluded && isQuoteCurrencyIncluded) {
        quoteCurrencyCommonNetworks = [];
      }
    }

    // TODO: investigate if this part is needed for validation
    // const [
    //   withdrawExchangeBaseCurrency,
    //   withdrawExchangeQuoteCurrency,
    //   depositExchangeBaseCurrency,
    //   depositExchangeQuoteCurrency,
    // ] = await Promise.all([
    //   withdrawExchange.getCurrency(baseCurrencyCode, true),
    //   withdrawExchange.getCurrency(quoteCurrencyCode, true),
    //   depositExchange.getCurrency(baseCurrencyCode, true),
    //   depositExchange.getCurrency(quoteCurrencyCode, true),
    // ]);
    // if (
    //   !withdrawExchangeBaseCurrency ||
    //   !withdrawExchangeQuoteCurrency ||
    //   !depositExchangeBaseCurrency ||
    //   !depositExchangeQuoteCurrency
    // ) {
    //   logger.debug(
    //     `Missing active currencies ${withdrawExchange.id}-${depositExchange.id}. Symbol: ${symbol}`
    //   );
    //   return null;
    // }

    const [
      withdrawExchangeOrderBook,
      depositExchangeOrderBook,
      withdrawExchangeTicker,
      depositExchangeTicker,
    ] = await Promise.all([
      withdrawExchange.getOrderBook(symbol, 20),
      depositExchange.getOrderBook(symbol, 20),
      withdrawExchange.getTicker(symbol),
      depositExchange.getTicker(symbol),
    ]);

    if (!withdrawExchangeOrderBook || !depositExchangeOrderBook) {
      logger.debug(
        `Missing order books ${withdrawExchange.id}-${depositExchange.id}. Symbol: ${symbol}`
      );
      return null;
    }

    return {
      withdrawExchangeMarketData,
      depositExchangeMarketData,
      withdrawExchangeOrderBook,
      depositExchangeOrderBook,
      withdrawExchangeTicker,
      depositExchangeTicker,
      baseCurrencyCommonNetworks,
      quoteCurrencyCommonNetworks,
    };
  }

  private async getCommonActiveNetworks(
    { withdrawExchange, depositExchange }: ExchangePair,
    code: string
  ): Promise<NetworkPair[]> {
    const [currencyOne, currencyTwo] = await Promise.all([
      withdrawExchange.getCurrency(code, true),
      depositExchange.getCurrency(code, true),
    ]);

    if (!currencyOne || !currencyTwo) {
      return [];
    }

    const [withdrawExchangeNetworkMap, depositExchangeNetworkMap] =
      await Promise.all([
        withdrawExchange.getNetworks(code, true),
        depositExchange.getNetworks(code, true),
      ]);
    const withdrawExchangeNetworks = Object.values(withdrawExchangeNetworkMap);
    const depositExchangeNetworks = Object.values(depositExchangeNetworkMap);

    const commonNetworks = [];
    for (const withdrawNetwork of withdrawExchangeNetworks) {
      for (const depositNetwork of depositExchangeNetworks) {
        if (this.isSameNetwork([withdrawNetwork, depositNetwork])) {
          const networkPair: NetworkPair = { withdrawNetwork, depositNetwork };
          commonNetworks.push(networkPair);

          if (
            typeof depositNetwork.deposit === "boolean" &&
            !depositNetwork.deposit
          ) {
            logger.warn("The network is not depositable!", { depositNetwork });
          }
        }
      }
    }
    return commonNetworks;
  }

  private isSameNetwork(networks: Network[]): boolean {
    const network = networks[0]?.network;
    for (const n of networks) {
      if (n.network !== network) {
        return false;
      }
    }
    return true;
  }

  private getExchangePermutations(): ExchangePair[] {
    const permutations: ExchangePair[] = [];
    for (let i = 0; i < this.exchanges.length; i++) {
      for (let j = i + 1; j < this.exchanges.length; j++) {
        const exchangeOne = this.exchanges[i];
        const exchangeTwo = this.exchanges[j];

        if (!exchangeOne || !exchangeTwo) {
          continue;
        }

        permutations.push(
          { withdrawExchange: exchangeOne, depositExchange: exchangeTwo },
          { withdrawExchange: exchangeTwo, depositExchange: exchangeOne }
        );
      }
    }
    return permutations;
  }
}
