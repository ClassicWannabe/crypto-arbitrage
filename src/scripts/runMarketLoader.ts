import { S3Client } from "@aws-sdk/client-s3";

import { getEnv } from "../helpers.js";
import { ExchangeFactory } from "../exchanges/ExchangeFactory/ExchangeFactory.js";
import { MarketLoader } from "../services/MarketLoader/MarketLoader.js";
import { Bucket } from "../storages/Bucket/Bucket.js";
import { EnvVariablesSetter } from "../services/EnvVariablesSetter/EnvVariablesSetter.js";

const s3Client = new S3Client();
const s3BucketName = getEnv("s3BucketName");
const bucket = new Bucket(s3Client, s3BucketName);

const envVariablesSetter = new EnvVariablesSetter();
await envVariablesSetter.load();

const exchangeFactory = new ExchangeFactory();
const exchanges = exchangeFactory.getAllExchanges();

const marketLoader = new MarketLoader(bucket, exchanges);

export const main = async () => {
  await marketLoader.saveMarkets();
};
