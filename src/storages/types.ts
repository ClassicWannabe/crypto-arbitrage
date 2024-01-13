export interface Storage {
  getSymbols(): Promise<string[]>;
  saveSymbols(symbols: string[]): Promise<void>;
}
