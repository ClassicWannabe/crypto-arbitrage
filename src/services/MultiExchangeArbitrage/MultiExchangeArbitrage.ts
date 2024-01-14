import { chunk } from "lodash-es";

import { MultiExchangeCalculator } from "../../calculators/MultiExchangeCalculator/MultiExchangeCalculator.js";
import { Formatter } from "../../formatters/types.js";
import { Publisher } from "../../publishers/types.js";
import { Storage } from "../../storages/types.js";
import { Service } from "../types.js";
import { ArbitrageData } from "../../types.js";
import { logger } from "../../logger/logger.js";
import { sleep } from "../../helpers.js";

export class MultiExchangeArbitrage implements Service {
  private exchangesLastReloadDate = new Date();

  constructor(
    private readonly calculator: MultiExchangeCalculator,
    private readonly formatter: Formatter,
    private readonly publisher: Publisher,
    private readonly storage: Storage,
    private readonly symbolsChunkSize = 100
  ) {}

  async process(): Promise<void> {
    await this.setMinProfitPercent();
    await this.processArbitrages();
    await this.reloadExchanges();
  }

  private async setMinProfitPercent() {
    const { minProfitPercent } = await this.storage.getArbitrageConfig();
    this.calculator.setMinProfitPercent(minProfitPercent);
    logger.info(`Set calculator min profit to ${minProfitPercent}%`);
  }

  private async processArbitrages() {
    const symbols = await this.storage.getSymbols();

    let processedSymbolsLength = 0;
    let iteration = 1;

    for (const symbolsChunk of chunk(symbols, this.symbolsChunkSize)) {
      const arbitrages = await this.calculateData(symbolsChunk);

      this.publishData(arbitrages);
      processedSymbolsLength += this.symbolsChunkSize;
      console.log("iteration", iteration);
      iteration++;
      if (processedSymbolsLength > 2000) {
        await sleep(120);
        processedSymbolsLength = 0;
      }
    }
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

  private async reloadExchanges() {
    if (!this.isAnyExchangeShouldBeReloaded()) {
      return;
    }
    await this.calculator.reloadAllExchanges();
    this.exchangesLastReloadDate = new Date();
  }

  private isAnyExchangeShouldBeReloaded(): boolean {
    const thirtyMinutes = 30;

    const passedTimeInSeconds =
      (new Date().getTime() - this.exchangesLastReloadDate.getTime()) / 1000;
    const passedTimeInMinutes = passedTimeInSeconds / 60;
    if (passedTimeInMinutes > thirtyMinutes) {
      return true;
    }
    return false;
  }
}
