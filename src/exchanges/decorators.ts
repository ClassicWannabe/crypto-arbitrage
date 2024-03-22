import { NetworkError } from "ccxt";

import { retryOnError } from "../decorators.js";

export const retryOnNetworkError = (maxRetries = 1) =>
  retryOnError([NetworkError], maxRetries);
