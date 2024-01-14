import ccxt from "ccxt";

import { ArbitrageConfig } from "../../storages/types.js";
import { Exchange, ExchangeType } from "../types.js";
import { ENV } from "../../consts.js";
import { Binance } from "../Binance/Binance.js";
import { Bybit } from "../Bybit/Bybit.js";
import { GateIO } from "../GateIO/GateIO.js";
import { HTX } from "../HTX/HTX.js";
import { Kucoin } from "../Kucoin/Kucoin.js";
import { OKX } from "../OKX/OKX.js";
import { MEXC } from "../MEXC/MEXC.js";

export class ExchangeFactory {
  constructor(private readonly arbitrageConfig: ArbitrageConfig) {}

  getExchange(type: ExchangeType): Exchange {
    const { rateLimits } = this.arbitrageConfig;

    switch (type) {
      case ExchangeType.BINANCE: {
        const ccxtBinance = new ccxt.binance({
          apiKey: ENV.binanceApiKey,
          secret: ENV.binanceApiSecret,
        });
        ccxtBinance.rateLimit = rateLimits.binance ?? ccxtBinance.rateLimit;

        return new Binance(ccxtBinance);
      }
      case ExchangeType.BYBIT: {
        const ccxtBybit = new ccxt.bybit({
          apiKey: ENV.bybitApiKey,
          secret: ENV.bybitApiSecret,
        });
        ccxtBybit.rateLimit = rateLimits.bybit ?? ccxtBybit.rateLimit;

        return new Bybit(ccxtBybit);
      }
      case ExchangeType.GATEIO: {
        const ccxtGateio = new ccxt.gateio({
          apiKey: ENV.gateioApiKey,
          secret: ENV.gateioApiSecret,
        });
        ccxtGateio.rateLimit = rateLimits.gateio ?? ccxtGateio.rateLimit;

        return new GateIO(ccxtGateio);
      }
      case ExchangeType.HTX: {
        const ccxtHtx = new ccxt.htx({
          apiKey: ENV.htxApiKey,
          secret: ENV.htxApiSecret,
        });
        ccxtHtx.rateLimit = rateLimits.htx ?? ccxtHtx.rateLimit;

        return new HTX(ccxtHtx);
      }
      case ExchangeType.KUCOIN: {
        const ccxtKucoin = new ccxt.kucoin({
          apiKey: ENV.kucoinApiKey,
          secret: ENV.kucoinApiSecret,
          password: ENV.kucoinApiPassword,
        });
        ccxtKucoin.rateLimit = rateLimits.kucoin ?? ccxtKucoin.rateLimit;

        return new Kucoin(ccxtKucoin);
      }
      case ExchangeType.OKX: {
        const ccxtOkx = new ccxt.okx({
          apiKey: ENV.okxApiKey,
          secret: ENV.okxApiSecret,
          password: ENV.okxApiPassword,
        });
        ccxtOkx.rateLimit = rateLimits.okx ?? ccxtOkx.rateLimit;

        return new OKX(ccxtOkx);
      }
      case ExchangeType.MEXC: {
        const ccxtMexc = new ccxt.mexc({
          apiKey: ENV.mexcApiKey,
          secret: ENV.mexcApiSecret,
        });
        ccxtMexc.rateLimit = rateLimits.mexc ?? ccxtMexc.rateLimit;

        return new MEXC(ccxtMexc);
      }
    }
  }
}
