import "dotenv/config";

import { sleep } from "../helpers.js";
import { FileStorage } from "../storages/File/File.js";
import { ExchangeFactory } from "../exchanges/ExchangeFactory/ExchangeFactory.js";
import { ArbitrageRepo } from "../storages/ArbitrageRepo/ArbitrageRepo.js";
import { MultiExchangeArbitrageProcessor } from "../services/MultiExchangeArbitrageProcessor/MultiExchangeArbitrageProcessor.js";

const storage = new FileStorage();
const arbitrageConfig = await storage.getArbitrageConfig();

const exchangeFactory = new ExchangeFactory(arbitrageConfig);
const exchanges = exchangeFactory.getAllExchanges();

const arbitrageRepo = new ArbitrageRepo();

const service = new MultiExchangeArbitrageProcessor(arbitrageRepo, exchanges);

const main = async () => {
  while (true) {
    await service.process();
    await sleep(10);
  }
};

await main();
