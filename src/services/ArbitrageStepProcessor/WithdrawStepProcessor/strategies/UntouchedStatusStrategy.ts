import { Exchange, Transcation } from "../../../../exchanges/types.js";
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
    const transaction = await this.withdrawCurrency();

    const newStatus = ArbitrageStepStatus.PROCESSING;
    await this.arbitrageRepo.updateWithdrawStep(
      {
        withdrawStepId: this.withdrawStep.withdrawStepId,
        arbitrageDataId: this.withdrawStep.arbitrageDataId,
      },
      {
        status: newStatus,
        transactionId: transaction.id,
        exchanges: {
          withdraw: { address: transaction.addressFrom ?? undefined },
        },
      }
    );

    return newStatus;
  }

  private async withdrawCurrency(): Promise<Transcation> {
    const {
      currencyCode,
      amount,
      exchanges: {
        deposit: { address: depositAddress },
      },
    } = this.withdrawStep;
    const withdrawExchange = this.exchanges.withdraw;

    return await withdrawExchange.withdraw(
      currencyCode,
      amount,
      depositAddress
    );
  }
}
