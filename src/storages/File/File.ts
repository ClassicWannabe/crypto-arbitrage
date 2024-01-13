import fs from "fs/promises";

import { Storage } from "../types.js";
import { SYMBOLS_PATH } from "./consts.js";

export class FileStorage implements Storage {
  async getSymbols(): Promise<string[]> {
    const json = await fs.readFile(SYMBOLS_PATH, { encoding: "utf-8" });

    const symbols = JSON.parse(json);

    return symbols ?? [];
  }

  async saveSymbols(symbols: string[]): Promise<void> {
    await fs.writeFile(SYMBOLS_PATH, JSON.stringify(symbols));
  }
}
