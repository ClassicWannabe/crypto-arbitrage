import {
  ArbitrageStepsCalculator,
  CalculateArbitrageStepsParams,
} from "./ArbitrageStepsCalculator.js";
import { MockOf } from "../../__utils__/utils.js";
import { Exchange } from "../../exchanges/types.js";
import { FeeCalculator } from "../FeeCalculator/FeeCalculator.js";

describe(ArbitrageStepsCalculator.name, () => {
  function createCalculator(
    initialParams?: Partial<CalculateArbitrageStepsParams>
  ) {
    const feeCalculator = MockOf<FeeCalculator>("calculateFees", "deductFee");
    const marketData = {
      active: true,
      base: "base",
      quote: "quote",
      maker: 10,
      taker: 10,
      symbol: "symbol",
      percentage: true,
    };
    const params: CalculateArbitrageStepsParams = {
      withdrawExchange: MockOf<Exchange>(),
      depositExchange: MockOf<Exchange>(),
      withdrawExchangeOrderBook: {
        asks: [],
        bids: [],
        symbol: "symbol",
        bestAsk: { base: 10, quote: 10 },
        bestBid: { base: 10, quote: 10 },
      },
      depositExchangeOrderBook: {
        asks: [],
        bids: [],
        symbol: "symbol",
        bestAsk: { base: 10, quote: 10 },
        bestBid: { base: 10, quote: 10 },
      },
      withdrawExchangeTicker: { symbol: "symbol", percentage: 0 },
      depositExchangeTicker: { symbol: "symbol", percentage: 0 },
      minProfitPercent: 0,
      withdrawExchangeMarketData: marketData,
      depositExchangeMarketData: marketData,
      ...initialParams,
    };
    const calculator = new ArbitrageStepsCalculator(feeCalculator, params);

    return {
      calculator,
      feeCalculator,
      params,
    };
  }

  describe("calculateForwardArbitrageSteps", () => {
    const { calculator } = createCalculator();

    it("should return steps if they are profitable", () => {});
  });
});
