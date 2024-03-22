import { sleep } from "./helpers.js";
import { logger } from "./logger/logger.js";

export const retryOnError = <TError extends Error>(
  errorClasses: (new (...args: any[]) => TError)[],
  maxRetries: number = 1
) => {
  return function <TReturnType>(
    _: Object,
    __: string | symbol,
    descriptor: TypedPropertyDescriptor<
      (...args: any[]) => Promise<TReturnType>
    >
  ) {
    const originalMethod = descriptor.value;
    const minWaitTimeSeconds = 0.5;

    descriptor.value = async function (...args: any[]): Promise<TReturnType> {
      mainLoop: for (let retry = 0; retry <= maxRetries; retry++) {
        try {
          const result = await originalMethod?.apply(this, args);
          return result as TReturnType;
        } catch (error) {
          for (const errorClass of errorClasses) {
            if (error instanceof errorClass) {
              logger.error(`Retry ${retry} after error: ${error.message}`);
              await sleep((retry + 1) * minWaitTimeSeconds);
              continue mainLoop;
            }
          }

          throw error;
        }
      }
      throw new Error(`Max retries reached`);
    };

    return descriptor;
  };
};
