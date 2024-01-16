import url from "url";
import path from "path";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataFolderPath = path.resolve(__dirname + "../../../../data");

export const SYMBOLS_PATH = path.resolve(dataFolderPath + "/symbols.json");

export const ARBITRAGE_CONFIG_PATH = path.resolve(
  dataFolderPath + "/arbitrage-config.json"
);
