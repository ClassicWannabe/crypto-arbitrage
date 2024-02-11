export const ENV = {
  node: process.env.NODE_ENV,
  logLevel: process.env.LOG_LEVEL,
  binanceApiKey: process.env.BINANCE_API_KEY,
  binanceApiSecret: process.env.BINANCE_API_SECRET,
  okxApiKey: process.env.OKX_API_KEY,
  okxApiSecret: process.env.OKX_API_SECRET,
  okxApiPassword: process.env.OKX_API_PASSWORD,
  bybitApiKey: process.env.BYBIT_API_KEY,
  bybitApiSecret: process.env.BYBIT_API_SECRET,
  kucoinApiKey: process.env.KUCOIN_API_KEY,
  kucoinApiSecret: process.env.KUCOIN_API_SECRET,
  kucoinApiPassword: process.env.KUCOIN_API_PASSWORD,
  gateioApiKey: process.env.GATEIO_API_KEY,
  gateioApiSecret: process.env.GATEIO_API_SECRET,
  htxApiKey: process.env.HTX_API_KEY,
  htxApiSecret: process.env.HTX_API_SECRET,
  mexcApiKey: process.env.MEXC_API_KEY,
  mexcApiSecret: process.env.MEXC_API_SECRET,
  bitgetApiKey: process.env.BITGET_API_KEY,
  bitgetApiSecret: process.env.BITGET_API_SECRET,
  bitgetApiPassword: process.env.BITGET_API_PASSWORD,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramGroupId: process.env.TELEGRAM_GROUP_ID,
  telegramDeveloperId: process.env.TELEGRAM_DEVELOPER_ID,
  awsRegion: process.env.AWS_REGION,
  awsSnsTopicParameterName: process.env.AWS_SNS_TOPIC_PARAMETER_NAME,
} as const;

export const DDB_TABLE_NAME = "crypto-arbitrage";

export const DDB_LOCAL_ENDPOINT = "http://localhost:8000";
