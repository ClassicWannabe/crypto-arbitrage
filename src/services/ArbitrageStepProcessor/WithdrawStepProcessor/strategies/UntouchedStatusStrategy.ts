import { Address, Exchange, Transcation } from "../../../../exchanges/types.js";
import { logger } from "../../../../logger/logger.js";
import { ArbitrageRepo } from "../../../../storages/ArbitrageRepo/ArbitrageRepo.js";
import { WithdrawArbitrageStep } from "../../../../storages/ddb/types.js";
import { ArbitrageStepStatus } from "../../../../storages/types.js";
import { Strategy } from "../../Strategy.js";

export type TransferExchanges = {
  withdraw: Exchange;
  deposit: Exchange;
};

export class UntouchedStatusStrategy extends Strategy {
  constructor(
    private readonly arbitrageRepo: ArbitrageRepo,
    private readonly exchanges: TransferExchanges,
    private readonly withdrawStep: WithdrawArbitrageStep
  ) {
    super();
  }

  async process() {
    const { currencyCode, networkId } = this.withdrawStep;
    const depositExchange = this.exchanges.deposit;
    const depositAddress =
      await depositExchange.getDepositAddress(currencyCode);
    this.checkDepositNetwork(depositAddress, networkId);
    const transcation = await this.withdrawCurrency(depositAddress.address);

    const newStatus = ArbitrageStepStatus.PROCESSING;
    await this.arbitrageRepo.updateWithdrawStep(
      {
        withdrawStepId: this.withdrawStep.withdrawStepId,
        arbitrageDataId: this.withdrawStep.arbitrageDataId,
      },
      {
        status: newStatus,
        transactionId: transcation.id,
        exchanges: {
          deposit: { address: depositAddress.address },
          withdraw: { address: transcation.addressFrom ?? undefined },
        },
      }
    );

    return newStatus;
  }

  private async withdrawCurrency(addressId: string): Promise<Transcation> {
    const { currencyCode, amount } = this.withdrawStep;
    const withdrawExchange = this.exchanges.withdraw;

    return await withdrawExchange.withdraw(currencyCode, amount, addressId);
  }

  private checkDepositNetwork(address: Address, network: string) {
    const commonNetwork = address.network.find((n) => n === network);
    if (!commonNetwork) {
      logger.error("Missing network", { address, network });
      throw new Error("Missing required deposit address network");
    }
  }
}
