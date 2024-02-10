import url from "url";
import path from "path";

import { Script } from "./types.js";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SCRIPT_PATHS: Record<Script, string> = {
  [Script.ARBITRAGE_FINDER]: path.resolve(
    __dirname + "/../../scripts/runArbitrageFinderService.js"
  ),
  [Script.ARBITRAGE_PROCESSOR]: path.resolve(
    __dirname + "/../../scripts/runArbitrageProcessorService.js"
  ),
};
