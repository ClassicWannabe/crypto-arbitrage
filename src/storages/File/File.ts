import fs from "fs/promises";

import { DeepPartialArbitrageConfig, Storage } from "../types.js";
import { ARBITRAGE_CONFIG_PATH, SYMBOLS_PATH } from "./consts.js";
import {
  arbitrageConfigSchema,
  deepPartialArbitrageConfigSchema,
} from "../schema.js";
import { customDeepmerge } from "../helpers.js";

export class FileStorage implements Storage {
  async getSymbols(): Promise<string[]> {
    const symbols = await this.getJsonFile(SYMBOLS_PATH);

    return symbols ?? [];
  }

  async saveSymbols(symbols: string[]): Promise<void> {
    await this.saveJsonFile(SYMBOLS_PATH, symbols);
  }

  async addIgnoredSymbol(symbol: string): Promise<void> {
    const storedSymbols = await this.getSymbols();
    const foundSymbol = storedSymbols.find(
      (storedSymbol) => storedSymbol.toLowerCase() === symbol.toLowerCase()
    );
    if (!foundSymbol) {
      throw new Error(
        "Cannot save symbol to ignore because it is missing in the tracking list"
      );
    }
    const config = await this.getArbitrageConfig();
    const ignoredSymbols = [
      ...new Set([...config.ignoredSymbols, foundSymbol]),
    ];

    await this.saveArbitrageConfig({ ...config, ignoredSymbols });
  }

  async removeIgnoredSymbol(symbol: string): Promise<void> {
    const config = await this.getArbitrageConfig();
    const ignoredSymbols = config.ignoredSymbols.filter(
      (ignoredSymbol) => ignoredSymbol.toLowerCase() !== symbol.toLowerCase()
    );

    await this.saveArbitrageConfig({ ...config, ignoredSymbols });
  }

  async getArbitrageConfig() {
    const config = await this.getJsonFile(ARBITRAGE_CONFIG_PATH);

    return arbitrageConfigSchema.parse(config);
  }

  async saveArbitrageConfig(config: DeepPartialArbitrageConfig) {
    const parsedConfig = deepPartialArbitrageConfigSchema.parse(config);
    const oldConfig = await this.getArbitrageConfig();
    const mergedConfig = customDeepmerge(oldConfig, parsedConfig);

    await this.saveJsonFile(ARBITRAGE_CONFIG_PATH, mergedConfig);
  }

  private async getJsonFile(path: string) {
    const json = await fs.readFile(path, { encoding: "utf-8" });
    return JSON.parse(json);
  }

  private async saveJsonFile(
    path: string,
    data: Record<string, unknown> | unknown[]
  ) {
    await fs.writeFile(path, JSON.stringify(data));
  }
}
