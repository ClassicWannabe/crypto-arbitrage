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
  private symbolPointer = 0;

  constructor(
    private readonly calculator: MultiExchangeCalculator,
    private readonly formatter: Formatter,
    private readonly publisher: Publisher,
    private readonly storage: Storage,
    private readonly symbolsChunkSize: number,
    private readonly ignoredSymbols: string[]
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
    logger.info(
      `Symbols chunk size: ${this.symbolsChunkSize}. Symbol pointer: ${this.symbolPointer}`
    );
    const symbols = await this.getSymbols();

    let iteration = this.symbolPointer / this.symbolsChunkSize + 1;
    for (const symbolsChunk of chunk(symbols, this.symbolsChunkSize)) {
      const arbitrages = await this.calculateData(symbolsChunk);

      if (arbitrages.length > 0) {
        logger.info("Found potential arbitrage offers", { arbitrages });
      }

      this.publishData(arbitrages);
      this.symbolPointer = iteration * this.symbolsChunkSize;
      iteration++;
    }
    logger.info("Successfully processed symbols", { symbols });
    this.symbolPointer = 0;
  }

  private async getSymbols() {
    const allSymbols = await this.storage.getSymbols();
    const trackedSymbols = allSymbols.filter(
      (symbol) => !this.ignoredSymbols.includes(symbol)
    );
    return trackedSymbols.slice(this.symbolPointer);
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
        const formattedMessage = await this.formatter.format(arbitrageData);
        await this.publisher.publish(
          formattedMessage.text,
          formattedMessage.image
        );
      })
    );
  }

  private async reloadExchanges() {
    if (!this.isAnyExchangeShouldBeReloaded()) {
      return;
    }
    await this.calculator.reloadAllExchanges();
    this.exchangesLastReloadDate = new Date();

    logger.info("Sleep 1 minute after reloading markets...");
    const sixtySeconds = 60;
    await sleep(sixtySeconds);
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
