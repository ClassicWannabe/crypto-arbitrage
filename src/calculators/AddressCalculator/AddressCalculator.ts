import { deepmerge } from "deepmerge-ts";

import { retryOnError } from "../../decorators.js";
import { Exchange } from "../../exchanges/types.js";
import { logger } from "../../logger/logger.js";

type SavedAddresses = {
  [exchangeId: string]: {
    [currencyCode: string]: {
      [networkId: string]: string;
    };
  };
};

type AddressArgs = {
  exchange: Exchange;
  currencyCode: string;
  networkId: string;
};

export class AddressCalculator {
  private savedAddresses: SavedAddresses = {};

  async getAddress(args: AddressArgs) {
    const savedAddress = this.getSavedAddress(args);
    if (savedAddress) {
      return savedAddress;
    }
    const address = await this.fetchAddress(args);

    if (!address) {
      logger.error({
        exchangeId: args.exchange.id,
        currencyCode: args.currencyCode,
        networkId: args.networkId,
      });
      throw new Error(`Missing deposit address`);
    }

    this.saveAddress({ ...args, address });

    return address;
  }

  private getSavedAddress({ currencyCode, exchange, networkId }: AddressArgs) {
    const address =
      this.savedAddresses[exchange.id]?.[currencyCode]?.[networkId] ?? null;

    return address;
  }

  @retryOnError([Error], 3)
  private async fetchAddress({
    currencyCode,
    exchange,
    networkId,
  }: AddressArgs) {
    let depositAddress;
    try {
      try {
        depositAddress = await exchange.getDepositAddress(currencyCode, {
          network: networkId,
        });
      } catch {
        depositAddress = await exchange.getDepositAddress(currencyCode);
      }
    } catch (error) {
      logger.warn({ currencyCode, networkId, exchange: exchange.id });
      logger.warn((error as Error).stack);
      depositAddress = await exchange.createDepositAddress(currencyCode, {
        network: networkId,
      });
    }

    return depositAddress?.address ?? null;
  }

  private saveAddress({
    currencyCode,
    exchange,
    networkId,
    address,
  }: AddressArgs & { address: string }) {
    this.savedAddresses = deepmerge(this.savedAddresses, {
      [exchange.id]: { [currencyCode]: { [networkId]: address } },
    });
  }
}
