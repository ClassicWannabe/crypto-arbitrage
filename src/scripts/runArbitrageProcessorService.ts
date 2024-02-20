import "dotenv/config";

import { S3Client } from "@aws-sdk/client-s3";

import { getEnv, sleep } from "../helpers.js";
import { FileStorage } from "../storages/File/File.js";
import { ExchangeFactory } from "../exchanges/ExchangeFactory/ExchangeFactory.js";
import { ArbitrageRepo } from "../storages/ArbitrageRepo/ArbitrageRepo.js";
import { MultiExchangeArbitrageProcessor } from "../services/MultiExchangeArbitrageProcessor/MultiExchangeArbitrageProcessor.js";
import { Bucket } from "../storages/Bucket/Bucket.js";
import { MarketLoader } from "../services/MarketLoader/MarketLoader.js";

const storage = new FileStorage();
const arbitrageConfig = await storage.getArbitrageConfig();

const exchangeFactory = new ExchangeFactory(arbitrageConfig);
const exchanges = exchangeFactory.getAllExchanges();

const arbitrageRepo = new ArbitrageRepo();

const service = new MultiExchangeArbitrageProcessor(arbitrageRepo, exchanges);
const s3Client = new S3Client();
const s3BucketName = getEnv("s3BucketName");
const bucket = new Bucket(s3Client, s3BucketName);
const marketLoader = new MarketLoader(bucket, exchanges);

const main = async () => {
  while (true) {
    await reloadMarkets();
    await service.process();
    await sleep(10);
  }
};

let timestampPointer = new Date().getTime();

const reloadMarkets = async () => {
  const now = Date.now();
  const tenMinutesInMiliseconds = 10 * 60 * 1000;
  if (now - timestampPointer < tenMinutesInMiliseconds) {
    return;
  }

  await marketLoader.populateExchanges();
  timestampPointer = new Date().getTime();
};

await main();
