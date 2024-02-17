import ccxt from "ccxt";

import { ArbitrageConfig } from "../../storages/types.js";
import { Exchange, ExchangeType } from "../types.js";
import { Binance } from "../Binance/Binance.js";
import { Bybit } from "../Bybit/Bybit.js";
import { GateIO } from "../GateIO/GateIO.js";
import { HTX } from "../HTX/HTX.js";
import { Kucoin } from "../Kucoin/Kucoin.js";
import { OKX } from "../OKX/OKX.js";
import { MEXC } from "../MEXC/MEXC.js";
import { BitGet } from "../BitGet/BitGet.js";
import { getEnv } from "../../helpers.js";

export class ExchangeFactory {
  constructor(private readonly arbitrageConfig?: ArbitrageConfig) {}

  getExchange(type: ExchangeType): Exchange {
    const { rateLimits, timeout } = this.arbitrageConfig ?? {};

    switch (type) {
      case ExchangeType.BINANCE: {
        const ccxtBinance = new ccxt.binance({
          apiKey: getEnv("binanceApiKey"),
          secret: getEnv("binanceApiSecret"),
        });
        ccxtBinance.rateLimit = rateLimits?.binance ?? ccxtBinance.rateLimit;
        ccxtBinance.timeout = timeout ?? ccxtBinance.timeout;

        return new Binance(ccxtBinance);
      }
      case ExchangeType.BYBIT: {
        const ccxtBybit = new ccxt.bybit({
          apiKey: getEnv("bybitApiKey"),
          secret: getEnv("bybitApiSecret"),
        });
        ccxtBybit.rateLimit = rateLimits?.bybit ?? ccxtBybit.rateLimit;
        ccxtBybit.timeout = timeout ?? ccxtBybit.timeout;

        return new Bybit(ccxtBybit);
      }
      case ExchangeType.GATEIO: {
        const ccxtGateio = new ccxt.gateio({
          apiKey: getEnv("gateioApiKey"),
          secret: getEnv("gateioApiSecret"),
        });
        ccxtGateio.rateLimit = rateLimits?.gateio ?? ccxtGateio.rateLimit;
        ccxtGateio.timeout = timeout ?? ccxtGateio.timeout;

        return new GateIO(ccxtGateio);
      }
      case ExchangeType.HTX: {
        const ccxtHtx = new ccxt.htx({
          apiKey: getEnv("htxApiKey"),
          secret: getEnv("htxApiSecret"),
        });
        ccxtHtx.rateLimit = rateLimits?.htx ?? ccxtHtx.rateLimit;
        ccxtHtx.timeout = timeout ?? ccxtHtx.timeout;

        return new HTX(ccxtHtx);
      }
      case ExchangeType.KUCOIN: {
        const ccxtKucoin = new ccxt.kucoin({
          apiKey: getEnv("kucoinApiKey"),
          secret: getEnv("kucoinApiSecret"),
          password: getEnv("kucoinApiPassword"),
        });
        ccxtKucoin.rateLimit = rateLimits?.kucoin ?? ccxtKucoin.rateLimit;
        ccxtKucoin.timeout = timeout ?? ccxtKucoin.timeout;

        return new Kucoin(ccxtKucoin);
      }
      case ExchangeType.OKX: {
        const ccxtOkx = new ccxt.okx({
          apiKey: getEnv("okxApiKey"),
          secret: getEnv("okxApiSecret"),
          password: getEnv("okxApiPassword"),
        });
        ccxtOkx.rateLimit = rateLimits?.okx ?? ccxtOkx.rateLimit;
        ccxtOkx.timeout = timeout ?? ccxtOkx.timeout;

        return new OKX(ccxtOkx);
      }
      case ExchangeType.MEXC: {
        const ccxtMexc = new ccxt.mexc({
          apiKey: getEnv("mexcApiKey"),
          secret: getEnv("mexcApiSecret"),
        });
        ccxtMexc.rateLimit = rateLimits?.mexc ?? ccxtMexc.rateLimit;
        ccxtMexc.timeout = timeout ?? ccxtMexc.timeout;

        return new MEXC(ccxtMexc);
      }
      case ExchangeType.BITGET: {
        const ccxtBitget = new ccxt.bitget({
          apiKey: getEnv("bitgetApiKey"),
          secret: getEnv("bitgetApiSecret"),
          password: getEnv("bitgetApiPassword"),
        });
        ccxtBitget.rateLimit = rateLimits?.mexc ?? ccxtBitget.rateLimit;
        ccxtBitget.timeout = timeout ?? ccxtBitget.timeout;

        return new BitGet(ccxtBitget);
      }
    }
  }

  getAllExchanges(): Exchange[] {
    return Object.values(ExchangeType).map((exchangeType) =>
      this.getExchange(exchangeType)
    );
  }
}
