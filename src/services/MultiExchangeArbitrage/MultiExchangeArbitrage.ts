import { chunk } from "lodash-es";

import { MultiExchangeCalculator } from "../../calculators/MultiExchangeCalculator/MultiExchangeCalculator.js";
import { Formatter } from "../../formatters/types.js";
import { Publisher } from "../../publishers/types.js";
import { Storage } from "../../storages/types.js";
import { Service } from "../types.js";
import { ArbitrageData } from "../../types.js";

export class MultiExchangeArbitrage implements Service {
  constructor(
    private readonly calculator: MultiExchangeCalculator,
    private readonly formatter: Formatter,
    private readonly publisher: Publisher,
    private readonly storage: Storage,
    private readonly symbolsChunkSize = 100
  ) {}

  async process(): Promise<void> {
    const symbols = await this.storage.getSymbols();

    await Promise.all(
      chunk(symbols, this.symbolsChunkSize).map(async (symbolsChunk) => {
        const arbitrages = await this.calculateData(symbolsChunk);

        this.publishData(arbitrages);
      })
    );
  }

  private async calculateData(symbols: string[]) {
    const dataArray = await Promise.all(
      symbols.map(async (symbol) => {
        return await this.calculator.calculate(symbol);
      })
    );

    return dataArray.flat();
  }

  private async publishData(arbitrages: ArbitrageData[]) {
    await Promise.all(
      arbitrages.map(async (arbitrageData) => {
        const formattedMessage = this.formatter.format(arbitrageData);
        await this.publisher.publish(formattedMessage);
      })
    );
  }
}
