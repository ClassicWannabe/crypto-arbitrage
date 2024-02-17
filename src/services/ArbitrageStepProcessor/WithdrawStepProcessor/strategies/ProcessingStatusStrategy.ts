import { Exchange } from "../../../../exchanges/types.js";
import { ArbitrageRepo } from "../../../../storages/ArbitrageRepo/ArbitrageRepo.js";
import { WithdrawArbitrageStep } from "../../../../storages/ddb/types.js";
import { ArbitrageStepStatus } from "../../../../storages/types.js";
import { Strategy } from "../../Strategy.js";

export class ProcessingStatusStrategy extends Strategy {
  constructor(
    private readonly arbitrageRepo: ArbitrageRepo,
    private readonly depositExchange: Exchange,
    private readonly withdrawStep: WithdrawArbitrageStep
  ) {
    super();
  }

  async process() {
    const foundDeposit = await this.findDeposit();

    if (!foundDeposit) {
      return this.withdrawStep.status;
    }

    return await this.updateStepDetails();
  }

  async findDeposit() {
    const { currencyCode, exchanges } = this.withdrawStep;
    const deposits = await this.depositExchange.getDeposits();
    const foundDeposit = deposits.find((deposit) => {
      const isSameCurrency = deposit.currency === currencyCode;
      let isSameAddress = true;
      if (deposit.addressFrom && exchanges.deposit.address) {
        isSameAddress = deposit.addressFrom === exchanges.deposit.address;
      }
      return isSameCurrency && isSameAddress;
    });

    return foundDeposit;
  }

  async updateStepDetails() {
    const newStatus = ArbitrageStepStatus.PROCESSED;
    await this.arbitrageRepo.updateWithdrawStep(
      {
        withdrawStepId: this.withdrawStep.withdrawStepId,
        arbitrageDataId: this.withdrawStep.arbitrageDataId,
      },
      {
        status: newStatus,
      }
    );
    return newStatus;
  }
}
