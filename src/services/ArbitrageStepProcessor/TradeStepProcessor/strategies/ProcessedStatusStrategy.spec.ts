import { ArbitrageDataStatus } from "../../../../storages/types.js";
import { ProcessedStatusStrategy } from "./ProcessedStatusStrategy.js";

function createStrategy(isLastStep = false) {
  const strategy = new ProcessedStatusStrategy(isLastStep);

  return { strategy };
}

describe(ProcessedStatusStrategy.name, () => {
  it("should return null if it is NOT the last step", async () => {
    const { strategy } = createStrategy();

    const result = await strategy.process();

    expect(result).toBeNull();
  });

  it("should return PROCESSED status if it is the last step", async () => {
    const { strategy } = createStrategy(true);

    const result = await strategy.process();

    expect(result).toBe(ArbitrageDataStatus.PROCESSED);
  });
});
