import { ArbitrageRepo } from "../../storages/ArbitrageRepo/ArbitrageRepo.js";
import { Service } from "../types.js";
import { Address, Exchange, Order } from "../../exchanges/types.js";
import { OrderStatus, TradeOperation } from "../../types.js";
import { logger } from "../../logger/logger.js";
import {
  ArbitrageCollection,
  ArbitrageData,
  ArbitrageStep,
  TradeArbitrageStep,
  WithdrawArbitrageStep,
} from "../../storages/ddb/types.js";
import {
  ArbitrageDataStatus,
  ArbitrageStepStatus,
  ArbitrageStepType,
} from "../../storages/types.js";

type Arbitrage = ArbitrageData & {
  steps: ArbitrageStep[];
};

type ProcessableArbitrage = Arbitrage & {
  status: Extract<ArbitrageDataStatus, "UNTOUCHED" | "PROCESSING">;
};

export class MultiExchangeArbitrageProcessor implements Service {
  constructor(
    private readonly arbitrageRepo: ArbitrageRepo,
    private readonly exchanges: Exchange[]
  ) {}

  async process(): Promise<void> {
    const arbitrages = await this.arbitrageRepo.getArbitrages();
    const formattedArbitrages = arbitrages.map(this.formatArbitrage);
    const validArbitrages = this.filterArbitrages(formattedArbitrages);
    await this.expireArbitrages(formattedArbitrages);

    for (const arbitrage of validArbitrages) {
      this.processArbitrage(arbitrage);
    }
  }

  private formatArbitrage(arbitrage: ArbitrageCollection): Arbitrage {
    const [arbitrageData] = arbitrage.arbitrageData;
    if (!arbitrageData) {
      throw new Error("Missing Arbitrage Data");
    }

    const tradeSteps = arbitrage.tradeStep;
    if (!tradeSteps.length) {
      throw new Error("Missing Trade Steps");
    }

    const withdrawSteps = arbitrage.withdrawStep;
    if (!withdrawSteps.length) {
      throw new Error("Missing Withdraw Steps");
    }

    const steps = [...tradeSteps, ...withdrawSteps];
    steps.sort((a, b) => a.stepOrder - b.stepOrder);

    return {
      ...arbitrageData,
      steps,
    };
  }

  private filterArbitrages(arbitrages: Arbitrage[]): ProcessableArbitrage[] {
    return arbitrages.filter(this.isProcessableArbitrage);
  }

  private async expireArbitrages(arbitrages: Arbitrage[]) {
    const expiredArbitrages = arbitrages.filter(this.isExpiredArbitrage);

    await Promise.all(
      expiredArbitrages.map(async ({ arbitrageDataId }) => {
        await this.arbitrageRepo.updateArbitrageData(
          { arbitrageDataId },
          { status: ArbitrageDataStatus.EXPIRED }
        );
      })
    );
  }

  private isProcessableArbitrage(
    arbitrage: Arbitrage
  ): arbitrage is ProcessableArbitrage {
    return !this.isExpiredArbitrage(arbitrage);
  }

  private isExpiredArbitrage(arbitrage: Arbitrage) {
    const tenMinutes = 10;
    const thrityMinutes = 30;
    const now = Date.now();
    const createdAt = new Date(arbitrage.createdAt).getTime();
    const passedTimeInMinutesSinceCreation = (now - createdAt) / 1000 / 60;

    if (arbitrage.status === ArbitrageDataStatus.PROCESSING) {
      return passedTimeInMinutesSinceCreation > thrityMinutes;
    }

    return passedTimeInMinutesSinceCreation > tenMinutes;
  }

  private async processArbitrage(arbitrage: ProcessableArbitrage) {
    for (const step of arbitrage.steps) {
      let updatedStatus: ArbitrageStepStatus;

      switch (step.stepType) {
        case ArbitrageStepType.TRADE: {
          updatedStatus = await this.processTradeArbitrageStep(step, arbitrage);
          break;
        }
        case ArbitrageStepType.WITHDRAW: {
          updatedStatus = await this.processWithdrawArbitrageStep(step);
          break;
        }
      }

      if (updatedStatus === ArbitrageStepStatus.PROCESSING) {
        await this.arbitrageRepo.updateArbitrageData(
          { arbitrageDataId: arbitrage.arbitrageDataId },
          { status: ArbitrageDataStatus.PROCESSING }
        );
        return;
      }

      if (updatedStatus === ArbitrageStepStatus.FAILED) {
        await this.arbitrageRepo.updateArbitrageData(
          { arbitrageDataId: arbitrage.arbitrageDataId },
          { status: ArbitrageDataStatus.FAILED }
        );
        return;
      }

      if (updatedStatus === ArbitrageStepStatus.CANCELLED) {
        await this.arbitrageRepo.updateArbitrageData(
          { arbitrageDataId: arbitrage.arbitrageDataId },
          { status: ArbitrageDataStatus.CANCELLED }
        );
        return;
      }
    }
  }

  private async processTradeArbitrageStep(
    tradeStep: TradeArbitrageStep,
    arbitrage: ProcessableArbitrage
  ): Promise<ArbitrageStepStatus> {
    this.checkArbitrageStepStatus(tradeStep.status);
    if (tradeStep.status === ArbitrageStepStatus.PROCESSED) {
      return tradeStep.status;
    }

    if (tradeStep.status === ArbitrageStepStatus.PROCESSING) {
      return await this.handleProcessingTradeArbitrageStep(
        tradeStep,
        arbitrage
      );
    }

    if (tradeStep.status === ArbitrageStepStatus.UNTOUCHED) {
      return await this.handleUntouchedTradeArbitrageStep(tradeStep, arbitrage);
    }

    throw new Error("Cannot process trade step:" + tradeStep.tradeStepId);
  }

  private async handleProcessingTradeArbitrageStep(
    tradeStep: TradeArbitrageStep,
    arbitrage: ProcessableArbitrage
  ): Promise<ArbitrageStepStatus> {
    const exchange = this.getExchange(tradeStep.exchangeId);
    const orderId = tradeStep.marketOrderId;
    if (!orderId) {
      throw new Error(
        `Order ID is missing in details. ArbitrageData ID: ${tradeStep.arbitrageDataId}. Arbitrage Step ID: ${tradeStep.tradeStepId}`
      );
    }
    const order = await exchange.getOrder(orderId, arbitrage.market.symbol);
    if (order.status === OrderStatus.OPEN) {
      return tradeStep.status;
    }
    if (order.status === OrderStatus.CLOSED) {
      const newStatus = ArbitrageStepStatus.PROCESSED;
      await this.arbitrageRepo.updateTradeStep(
        {
          arbitrageDataId: tradeStep.arbitrageDataId,
          tradeStepId: tradeStep.tradeStepId,
        },
        {
          status: newStatus,
        }
      );
      return newStatus;
    }

    const newStatus = ArbitrageStepStatus.FAILED;
    await this.arbitrageRepo.updateTradeStep(
      {
        arbitrageDataId: tradeStep.arbitrageDataId,
        tradeStepId: tradeStep.tradeStepId,
      },
      {
        status: newStatus,
      }
    );
    return newStatus;
  }

  private async handleUntouchedTradeArbitrageStep(
    tradeStep: TradeArbitrageStep,
    arbitrage: ProcessableArbitrage
  ): Promise<ArbitrageStepStatus> {
    const exchange = this.getExchange(tradeStep.exchangeId);
    const balance = await exchange.getBalance();
    let order: Order;
    if (tradeStep.tradeOperation === TradeOperation.BUY) {
      const requiredBalance = tradeStep.amount * tradeStep.price;
      const quoteCurrencyBalance =
        balance.free[arbitrage.market.quoteCurrencyCode] ?? 0;

      if (quoteCurrencyBalance < requiredBalance) {
        throw new Error(
          `Insufficient balance. Exchange: ${exchange.id}. Currency: ${arbitrage.market.quoteCurrencyCode}`
        );
      }

      order = await exchange.createLimitBuyOrder(
        arbitrage.market.symbol,
        tradeStep.amount,
        tradeStep.price
      );
    } else {
      const requiredBalance = tradeStep.amount;
      const baseCurrencyBalance =
        balance.free[arbitrage.market.baseCurrencyCode] ?? 0;

      if (baseCurrencyBalance < requiredBalance) {
        throw new Error(
          `Insufficient balance. Exchange: ${exchange.id}. Currency: ${arbitrage.market.baseCurrencyCode}`
        );
      }

      order = await exchange.createLimitSellOrder(
        arbitrage.market.symbol,
        tradeStep.amount,
        tradeStep.price
      );
    }

    const newStatus = ArbitrageStepStatus.PROCESSING;
    await this.arbitrageRepo.updateTradeStep(
      {
        tradeStepId: tradeStep.tradeStepId,
        arbitrageDataId: tradeStep.arbitrageDataId,
      },
      {
        status: newStatus,
        marketOrderId: order.id,
      }
    );
    return newStatus;
  }

  private async processWithdrawArbitrageStep(
    withdrawStep: WithdrawArbitrageStep
  ): Promise<ArbitrageStepStatus> {
    this.checkArbitrageStepStatus(withdrawStep.status);
    if (withdrawStep.status === ArbitrageStepStatus.PROCESSED) {
      return withdrawStep.status;
    }

    if (withdrawStep.status === ArbitrageStepStatus.PROCESSING) {
      return await this.handleProcessingWithdrawArbitrageStep(withdrawStep);
    }

    if (withdrawStep.status === ArbitrageStepStatus.UNTOUCHED) {
      return await this.handleUntouchedWithdrawArbitrageStep(withdrawStep);
    }
    throw new Error(
      "Cannot process withdraw step:" + withdrawStep.withdrawStepId
    );
  }

  private async handleProcessingWithdrawArbitrageStep(
    withdrawStep: WithdrawArbitrageStep
  ): Promise<ArbitrageStepStatus> {
    const { currencyCode, exchanges } = withdrawStep;
    const depositExchangeId = exchanges.deposit.id;
    const depositExchange = this.getExchange(depositExchangeId);

    const deposits = await depositExchange.getDeposits();
    const foundDeposit = deposits.find((deposit) => {
      const isSameCurrency = deposit.currency === currencyCode;
      let isSameAddress = true;
      if (deposit.addressFrom && exchanges.deposit.address) {
        isSameAddress = deposit.addressFrom === exchanges.deposit.address;
      }
      return isSameCurrency && isSameAddress;
    });

    if (!foundDeposit) {
      return withdrawStep.status;
    }

    const newStatus = ArbitrageStepStatus.PROCESSED;
    await this.arbitrageRepo.updateWithdrawStep(
      {
        withdrawStepId: withdrawStep.withdrawStepId,
        arbitrageDataId: withdrawStep.arbitrageDataId,
      },
      {
        status: newStatus,
      }
    );
    return newStatus;
  }

  private async handleUntouchedWithdrawArbitrageStep(
    withdrawStep: WithdrawArbitrageStep
  ): Promise<ArbitrageStepStatus> {
    const { currencyCode, amount, exchanges, networkId } = withdrawStep;
    const withdrawExchangeId = exchanges.withdraw.id;
    const depositExchangeId = exchanges.deposit.id;
    const withdrawExchange = this.getExchange(withdrawExchangeId);
    const depositExchange = this.getExchange(depositExchangeId);

    const depositAddress =
      await depositExchange.getDepositAddress(currencyCode);
    this.checkDepositNetwork(depositAddress, networkId);

    await withdrawExchange.withdraw(
      currencyCode,
      amount,
      depositAddress.address
    );

    const newStatus = ArbitrageStepStatus.PROCESSING;
    await this.arbitrageRepo.updateWithdrawStep(
      {
        withdrawStepId: withdrawStep.withdrawStepId,
        arbitrageDataId: withdrawStep.arbitrageDataId,
      },
      {
        status: newStatus,
      }
    );

    return newStatus;
  }

  private checkDepositNetwork(address: Address, network: string) {
    const commonNetwork = address.network.find((n) => n === network);
    if (!commonNetwork) {
      logger.error("Missing network", { address, network });
      throw new Error("Missing required deposit address network");
    }
  }

  private getExchange(id: string) {
    const exchange = this.exchanges.find((e) => e.id === id);

    if (!exchange) {
      throw new Error("Could not find the exchange by id:" + id);
    }

    return exchange;
  }

  private checkArbitrageStepStatus(
    status: ArbitrageStepStatus
  ): asserts status is
    | ArbitrageStepStatus.PROCESSED
    | ArbitrageStepStatus.PROCESSING
    | ArbitrageStepStatus.UNTOUCHED {
    const validStatuses: ArbitrageStepStatus[] = [
      ArbitrageStepStatus.PROCESSED,
      ArbitrageStepStatus.PROCESSING,
      ArbitrageStepStatus.UNTOUCHED,
    ];

    if (validStatuses.includes(status)) {
      return;
    }

    throw new Error("Cannot process step with such status:" + status);
  }
}
