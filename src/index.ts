import "dotenv/config";
import ccxt from "ccxt";
import fs from "fs";

import { MultiExchangeArbitrage } from "./calculators/MultiExchangeArbitrage/MultiExchangeArbitrage.js";
import { Binance } from "./exchanges/Binance/Binance.js";
import { GateIO } from "./exchanges/GateIO/GateIO.js";
import { HTX } from "./exchanges/HTX/HTX.js";
import { OKX } from "./exchanges/OKX/OKX.js";
import { Bybit } from "./exchanges/Bybit/Bybit.js";
import { Kucoin } from "./exchanges/Kucoin/Kucoin.js";
import { MEXC } from "./exchanges/MEXC/MEXC.js";

const ccxtBinance = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_API_SECRET,
});
const binance = new Binance(ccxtBinance);

const ccxtOkx = new ccxt.okx({
  apiKey: process.env.OKX_API_KEY,
  secret: process.env.OKX_API_SECRET,
});
// const okx = new OKX(ccxtOkx);

const ccxtBybit = new ccxt.bybit({
  apiKey: process.env.BYBIT_API_KEY,
  secret: process.env.BYBIT_API_SECRET,
});
const bybit = new Bybit(ccxtBybit);

const ccxtKucoin = new ccxt.kucoin({
  apiKey: process.env.KUCOIN_API_KEY,
  secret: process.env.KUCOIN_API_SECRET,
});
// const kucoin = new Kucoin(ccxtKucoin);

const ccxtGateio = new ccxt.gateio({
  apiKey: process.env.GATEIO_API_KEY,
  secret: process.env.GATEIO_API_SECRET,
});
const gateio = new GateIO(ccxtGateio);

const ccxtHtx = new ccxt.htx({
  apiKey: process.env.HTX_API_KEY,
  secret: process.env.HTX_API_SECRET,
});
const htx = new HTX(ccxtHtx);

const ccxtMexc = new ccxt.mexc({
  apiKey: process.env.MEXC_API_KEY,
  secret: process.env.MEXC_API_SECRET,
});
const mexc = new MEXC(ccxtMexc);

const exchanges = [binance, htx, gateio];

const service = new MultiExchangeArbitrage(exchanges, 5);

export async function main() {
  const markets = fs.readFileSync(`temp/${binance.id}-markets.json`, {
    encoding: "utf-8",
  });
  const symbols = Object.keys(JSON.parse(markets)).slice(0, 101);

  console.log(symbols);

  const data = await service.calculate(symbols);

  if (!data.length) return null;

  fs.writeFileSync(
    "temp/multi-exchange-arbitrages.json",
    JSON.stringify(data, null, 2)
  );
  console.log(JSON.stringify(data, null, 2));
}

main();
