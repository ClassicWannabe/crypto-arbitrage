import fs from "fs/promises";
import { deepmerge } from "deepmerge-ts";

import { DeepPartialArbitrageConfig, Storage } from "../types.js";
import { ARBITRAGE_CONFIG_PATH, SYMBOLS_PATH } from "./consts.js";
import {
  arbitrageConfigSchema,
  deepPartialArbitrageConfigSchema,
} from "../schema.js";

export class FileStorage implements Storage {
  async getSymbols(): Promise<string[]> {
    const symbols = await this.getJsonFile(SYMBOLS_PATH);

    return symbols ?? [];
  }

  async saveSymbols(symbols: string[]): Promise<void> {
    await this.saveJsonFile(SYMBOLS_PATH, symbols);
  }

  async getArbitrageConfig() {
    const config = await this.getJsonFile(ARBITRAGE_CONFIG_PATH);

    return arbitrageConfigSchema.parse(config);
  }

  async saveArbitrageConfig(config: DeepPartialArbitrageConfig) {
    const parsedConfig = deepPartialArbitrageConfigSchema.parse(config);
    const oldConfig = await this.getArbitrageConfig();
    const mergedConfig = deepmerge(oldConfig, parsedConfig);

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
