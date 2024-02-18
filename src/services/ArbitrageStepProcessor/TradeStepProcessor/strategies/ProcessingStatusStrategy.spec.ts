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
import { ProcessingStatusStrategy } from "./ProcessingStatusStrategy.js";
import { generateArbitrageData } from "../../../../__mocks__/generateArbitrageData.spec.js";
import { OrderStatus } from "../../../../types.js";
import { generateOrder } from "../../../../__mocks__/generateOrder.spec.js";

function createStrategy(
  options: {
    mockTradeStep?: PartialDeep<TradeArbitrageStep>;
    mockArbitrageData?: PartialDeep<ArbitrageData>;
  } = {}
) {
  const { mockArbitrageData, mockTradeStep } = options;
  const arbitrageRepo = MockOf<ArbitrageRepo>("updateTradeStep");
  const exchange = MockOf<Exchange>("getOrder");
  const tradeStep = generateTradeArbitrageStep({
    status: ArbitrageStepStatus.PROCESSING,
    ...mockTradeStep,
  });
  const arbitrageData = generateArbitrageData(mockArbitrageData);
  const strategy = new ProcessingStatusStrategy(
    arbitrageRepo,
    exchange,
    tradeStep,
    arbitrageData
  );

  return { strategy, arbitrageRepo, exchange, tradeStep, arbitrageData };
}

describe(ProcessingStatusStrategy.name, () => {
  it("should return FAILED status if market order ID is missing", async () => {
    const { strategy } = createStrategy({
      mockTradeStep: { marketOrderId: undefined },
    });

    const result = await strategy.process();

    expect(result).toBe(ArbitrageDataStatus.FAILED);
  });

  it("should return PROCESSING status if order is still open", async () => {
    const { strategy, exchange } = createStrategy();
    const mockOrder = generateOrder({ status: OrderStatus.OPEN });
    vi.spyOn(exchange, "getOrder").mockResolvedValue(mockOrder);

    const result = await strategy.process();

    expect(result).toBe(ArbitrageDataStatus.PROCESSING);
  });

  it("should return PROCESSED status if order is closed", async () => {
    const { strategy, exchange } = createStrategy();
    const mockOrder = generateOrder({ status: OrderStatus.CLOSED });
    vi.spyOn(exchange, "getOrder").mockResolvedValue(mockOrder);

    const result = await strategy.process();

    expect(result).toBe(ArbitrageDataStatus.PROCESSED);
  });

  it("should return FAILED status if order is neither OPEN nor CLOSED", async () => {
    const { strategy, exchange } = createStrategy();
    const mockOrder = generateOrder({ status: OrderStatus.CANCELED });
    vi.spyOn(exchange, "getOrder").mockResolvedValue(mockOrder);

    const result = await strategy.process();

    expect(result).toBe(ArbitrageDataStatus.FAILED);
  });
});
