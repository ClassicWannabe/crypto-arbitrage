import { FeeCalculator } from "./FeeCalculator.js";
import { MockOf } from "../../__utils__/utils.js";
import { Exchange } from "../../exchanges/types.js";
import { FeeType } from "../../types.js";

describe(FeeCalculator.name, () => {
  function createCalculator() {
    const calculator = new FeeCalculator();

    return {
      calculator,
    };
  }

  describe("calculateFees", () => {
    const mockArgs = {
      withdrawExchange: MockOf<Exchange>("getTradingFee", "getWithdrawFee"),
      depositExchange: MockOf<Exchange>("getTradingFee"),
      symbol: "symbol",
      currencyCode: "currencyCode",
      networkName: "networkName",
    };

    it("should return empty fees", async () => {
      const emptyFee = { type: FeeType.FIXED, value: 0 };
      const { calculator } = createCalculator();

      const fees = await calculator.calculateFees(mockArgs);

      expect(fees).toEqual({
        withdrawExchangeTradeFee: emptyFee,
        depositExchangeTradeFee: emptyFee,
        withdrawFee: emptyFee,
      });
    });

    it("should return calculated fees", async () => {
      const mockTradingFee = {
        type: FeeType.PERCENT,
        value: 10,
      };
      const mockWithdrawFee = { type: FeeType.FIXED, value: 2 };
      const { calculator } = createCalculator();
      vi.spyOn(mockArgs.withdrawExchange, "getTradingFee").mockResolvedValue(
        mockTradingFee
      );
      vi.spyOn(mockArgs.depositExchange, "getTradingFee").mockResolvedValue({
        ...mockTradingFee,
        value: 5,
      });
      vi.spyOn(mockArgs.withdrawExchange, "getWithdrawFee").mockResolvedValue(
        mockWithdrawFee
      );

      const fees = await calculator.calculateFees(mockArgs);

      expect(fees).toEqual({
        withdrawExchangeTradeFee: mockTradingFee,
        depositExchangeTradeFee: { ...mockTradingFee, value: 5 },
        withdrawFee: mockWithdrawFee,
      });
    });
  });

  describe("deductFee", () => {
    it("should deduct percentage", () => {
      const mockFee = {
        type: FeeType.PERCENT,
        value: 0.1,
      };
      const { calculator } = createCalculator();

      const result = calculator.deductFee(110, mockFee);

      expect(result).toBe(99);
    });

    it("should deduct fixed value", () => {
      const mockFee = {
        type: FeeType.FIXED,
        value: 5,
      };
      const { calculator } = createCalculator();

      const result = calculator.deductFee(110, mockFee);

      expect(result).toBe(105);
    });
  });
});
