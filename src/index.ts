import ccxt from 'ccxt'
import fs from 'fs'

const binance = new ccxt.binance()
const kraken = new ccxt.kraken()

export async function main() {
    await binance.loadMarkets()
    await kraken.loadMarkets()

    console.log(process.env)

    fs.writeFileSync('temp/binance-markets.json', JSON.stringify(binance.markets, null, 2))
    fs.writeFileSync('temp/kraken-markets.json', JSON.stringify(kraken.markets, null, 2))
}

main()
