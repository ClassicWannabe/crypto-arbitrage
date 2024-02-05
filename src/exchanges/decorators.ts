import { NetworkError } from "ccxt";

import { logger } from "../logger/logger.js";

export const retryOnError = (maxRetries: number = 1) => {
  return function <TReturnType>(
    _: Object,
    __: string | symbol,
    descriptor: TypedPropertyDescriptor<
      (...args: any[]) => Promise<TReturnType>
    >
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]): Promise<TReturnType> {
      let retries = 0;

      while (retries <= maxRetries) {
        try {
          const result = await originalMethod?.apply(this, args);
          return result as TReturnType;
        } catch (error) {
          if (error instanceof NetworkError) {
            retries++;
            logger.error(`Retry ${retries} after error: ${error.message}`);
          }

          throw error;
        }
      }
      throw new Error(`Max retries reached`);
    };

    return descriptor;
  };
};
