import "dotenv/config";
import { sleep } from "../helpers.js";
import { FileStorage } from "../storages/File/File.js";

import { ExchangeFactory } from "../exchanges/ExchangeFactory/ExchangeFactory.js";
import { ExchangeType } from "../exchanges/types.js";
import { ArbitrageRepo } from "../storages/ArbitrageRepo/ArbitrageRepo.js";
import { MultiExchangeArbitrageProcessor } from "../services/MultiExchangeArbitrageProcessor/MultiExchangeArbitrageProcessor.js";

const storage = new FileStorage();
const arbitrageConfig = await storage.getArbitrageConfig();

const exchangeFactory = new ExchangeFactory(arbitrageConfig);

const binance = exchangeFactory.getExchange(ExchangeType.BINANCE);
const okx = exchangeFactory.getExchange(ExchangeType.OKX);
const bybit = exchangeFactory.getExchange(ExchangeType.BYBIT);
const kucoin = exchangeFactory.getExchange(ExchangeType.KUCOIN);
const gateio = exchangeFactory.getExchange(ExchangeType.GATEIO);
const htx = exchangeFactory.getExchange(ExchangeType.HTX);
const mexc = exchangeFactory.getExchange(ExchangeType.MEXC);
const bitget = exchangeFactory.getExchange(ExchangeType.BITGET);
const exchanges = [mexc, binance, htx, gateio, okx, bybit, kucoin, bitget];

const arbitrageRepo = new ArbitrageRepo();

const service = new MultiExchangeArbitrageProcessor(arbitrageRepo, exchanges);

const main = async () => {
  while (true) {
    await service.process();
    await sleep(10);
  }
};

await main();
