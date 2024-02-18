import { PartialDeep } from "type-fest";
import { generateTradeArbitrageStep } from "../../../../__mocks__/generateTradeArbitrageStep.spec.js";
import { MockOf } from "../../../../__utils__/utils.spec.js";
import { Exchange } from "../../../../exchanges/types.js";
import { ArbitrageRepo } from "../../../../storages/ArbitrageRepo/ArbitrageRepo.js";
import {
  ArbitrageData,
  TradeArbitrageStep,
} from "../../../../storages/ddb/types.js";
import {
  ArbitrageDataStatus,
  ArbitrageStepStatus,
} from "../../../../storages/types.js";
import { UntouchedStatusStrategy } from "./UntouchedStatusStrategy.js";
import { generateArbitrageData } from "../../../../__mocks__/generateArbitrageData.spec.js";
import { OrderStatus, TradeOperation } from "../../../../types.js";
import { generateOrder } from "../../../../__mocks__/generateOrder.spec.js";
import { generateBalance } from "../../../../__mocks__/generateBalance.spec.js";

function createStrategy(
  options: {
    mockTradeStep?: PartialDeep<TradeArbitrageStep>;
    mockArbitrageData?: PartialDeep<ArbitrageData>;
  } = {}
) {
  const { mockArbitrageData, mockTradeStep } = options;
  const arbitrageRepo = MockOf<ArbitrageRepo>("updateTradeStep");
  const exchange = MockOf<Exchange>(
    "getBalance",
    "createLimitBuyOrder",
    "createLimitSellOrder"
  );
  const tradeStep = generateTradeArbitrageStep({
    status: ArbitrageStepStatus.PROCESSING,
    ...mockTradeStep,
  });
  const arbitrageData = generateArbitrageData(mockArbitrageData);
  const strategy = new UntouchedStatusStrategy(
    arbitrageRepo,
    exchange,
    tradeStep,
    arbitrageData
  );

  return { strategy, arbitrageRepo, exchange, tradeStep, arbitrageData };
}

describe(UntouchedStatusStrategy.name, () => {
  describe("buy operation", () => {
    it("should return FAILED status if there is insufficient balance", async () => {
      const mockQuoteCurrencyCode = "USDT";
      const { strategy, exchange } = createStrategy({
        mockTradeStep: {
          tradeOperation: TradeOperation.BUY,
          amount: 10,
          price: 10,
        },
        mockArbitrageData: {
          market: { quoteCurrencyCode: mockQuoteCurrencyCode },
        },
      });
      const mockBalance = generateBalance({
        free: { [mockQuoteCurrencyCode]: 99.99 },
      });
      vi.spyOn(exchange, "getBalance").mockResolvedValue(mockBalance);

      const result = await strategy.process();

      expect(result).toBe(ArbitrageDataStatus.FAILED);
    });

    it("should create limit buy order", async () => {
      const mockQuoteCurrencyCode = "USDT";
      const { strategy, exchange, tradeStep, arbitrageData } = createStrategy({
        mockTradeStep: {
          tradeOperation: TradeOperation.BUY,
          amount: 10,
          price: 10,
        },
        mockArbitrageData: {
          market: { quoteCurrencyCode: mockQuoteCurrencyCode },
        },
      });
      const mockBalance = generateBalance({
        free: { [mockQuoteCurrencyCode]: 101 },
      });
      vi.spyOn(exchange, "getBalance").mockResolvedValue(mockBalance);
      const mockOrder = generateOrder();
      const createLimitBuyOrderSpy = vi
        .spyOn(exchange, "createLimitBuyOrder")
        .mockResolvedValue(mockOrder);

      await strategy.process();

      expect(createLimitBuyOrderSpy).toHaveBeenCalledWith(
        arbitrageData.market.symbol,
        tradeStep.amount,
        tradeStep.price
      );
    });
  });

  describe("sell operation", () => {
    it("should return FAILED status if there is insufficient balance", async () => {
      const mockQuoteCurrencyCode = "USDT";
      const { strategy, exchange } = createStrategy({
        mockTradeStep: {
          tradeOperation: TradeOperation.SELL,
          amount: 10,
          price: 10,
        },
        mockArbitrageData: {
          market: { baseCurrencyCode: mockQuoteCurrencyCode },
        },
      });
      const mockBalance = generateBalance({
        free: { [mockQuoteCurrencyCode]: 9.99 },
      });
      vi.spyOn(exchange, "getBalance").mockResolvedValue(mockBalance);

      const result = await strategy.process();

      expect(result).toBe(ArbitrageDataStatus.FAILED);
    });

    it("should create limit sell order", async () => {
      const mockQuoteCurrencyCode = "USDT";
      const { strategy, exchange, tradeStep, arbitrageData } = createStrategy({
        mockTradeStep: {
          tradeOperation: TradeOperation.SELL,
          amount: 10,
          price: 10,
        },
        mockArbitrageData: {
          market: { baseCurrencyCode: mockQuoteCurrencyCode },
        },
      });
      const mockBalance = generateBalance({
        free: { [mockQuoteCurrencyCode]: 11 },
      });
      vi.spyOn(exchange, "getBalance").mockResolvedValue(mockBalance);
      const mockOrder = generateOrder();
      const createLimitSellOrderSpy = vi
        .spyOn(exchange, "createLimitSellOrder")
        .mockResolvedValue(mockOrder);

      await strategy.process();

      expect(createLimitSellOrderSpy).toHaveBeenCalledWith(
        arbitrageData.market.symbol,
        tradeStep.amount,
        tradeStep.price
      );
    });
  });

  it("should update step details when order is created", async () => {
    const mockQuoteCurrencyCode = "USDT";
    const { strategy, exchange, tradeStep, arbitrageRepo } = createStrategy({
      mockTradeStep: {
        tradeOperation: TradeOperation.SELL,
        amount: 10,
        price: 10,
      },
      mockArbitrageData: {
        market: { baseCurrencyCode: mockQuoteCurrencyCode },
      },
    });
    const mockBalance = generateBalance({
      free: { [mockQuoteCurrencyCode]: 11 },
    });
    vi.spyOn(exchange, "getBalance").mockResolvedValue(mockBalance);
    const mockOrder = generateOrder();
    vi.spyOn(exchange, "createLimitSellOrder").mockResolvedValue(mockOrder);
    const updateTradeStepSpy = vi.spyOn(arbitrageRepo, "updateTradeStep");

    await strategy.process();

    expect(updateTradeStepSpy).toHaveBeenCalledWith(
      {
        tradeStepId: tradeStep.tradeStepId,
        arbitrageDataId: tradeStep.arbitrageDataId,
      },
      {
        status: ArbitrageDataStatus.PROCESSING,
        marketOrderId: mockOrder.id,
      }
    );
  });
});
