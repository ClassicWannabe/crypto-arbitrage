import { ArbitrageRepo } from "../../storages/ArbitrageRepo/ArbitrageRepo.js";
import { Service } from "../types.js";
import { Exchange } from "../../exchanges/types.js";
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
  ArbitrageStepType,
} from "../../storages/types.js";
import { TradeStepStrategyFactory } from "../ArbitrageStepProcessor/TradeStepProcessor/TradeStepStrategyFactory.js";
import { TradeStepProcessor } from "../ArbitrageStepProcessor/TradeStepProcessor/TradeStepProcessor.js";
import { WithdrawStepProcessor } from "../ArbitrageStepProcessor/WithdrawStepProcessor/WithdrawStepProcessor.js";
import { WithdrawStepStrategyFactory } from "../ArbitrageStepProcessor/WithdrawStepProcessor/WithdrawStepStrategyFactory.js";

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
      try {
        await this.processArbitrage(arbitrage);
      } catch (e) {
        const error = e as Error;
        logger.error("Failed to process arbitrage", { error: error.stack });
      }
    }
  }

  private formatArbitrage(arbitrage: ArbitrageCollection): Arbitrage {
    const [arbitrageData] = arbitrage.arbitrageData;
    if (!arbitrageData) {
      throw new Error("Missing Arbitrage Data");
    }

    const tradeSteps = arbitrage.tradeStep;
    const withdrawSteps = arbitrage.withdrawStep;

    const steps = [...tradeSteps, ...withdrawSteps];
    steps.sort((a, b) => a.stepOrder - b.stepOrder);

    return {
      ...arbitrageData,
      steps,
    };
  }

  private filterArbitrages(arbitrages: Arbitrage[]): ProcessableArbitrage[] {
    return arbitrages.filter((arbitrage): arbitrage is ProcessableArbitrage =>
      this.isProcessableArbitrage(arbitrage)
    );
  }

  private async expireArbitrages(arbitrages: Arbitrage[]) {
    const expiredArbitrages = arbitrages.filter((arbitrage) =>
      this.isExpiredArbitrage(arbitrage)
    );

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
    return !this.isExpiredArbitrage(arbitrage) && arbitrage.steps.length > 0;
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
      let updatedStatus: ArbitrageDataStatus | null;
      const isLastStep = this.isLastStep(step, arbitrage.steps);
      switch (step.stepType) {
        case ArbitrageStepType.TRADE: {
          updatedStatus = await this.processTradeArbitrageStep(
            step,
            arbitrage,
            isLastStep
          );
          break;
        }
        case ArbitrageStepType.WITHDRAW: {
          updatedStatus = await this.processWithdrawArbitrageStep(
            step,
            isLastStep
          );
          break;
        }
      }

      if (updatedStatus) {
        await this.arbitrageRepo.updateArbitrageData(
          { arbitrageDataId: arbitrage.arbitrageDataId },
          { status: updatedStatus }
        );
        return;
      }
    }
  }

  private isLastStep(
    currentStep: ArbitrageStep,
    steps: ArbitrageStep[]
  ): boolean {
    const lastStep = steps[steps.length - 1];
    if (!lastStep) {
      return false;
    }
    const lastStepId = this.getStepId(lastStep);
    const currentStepId = this.getStepId(currentStep);

    return currentStepId === lastStepId;
  }

  private getStepId(step: ArbitrageStep): string {
    switch (step.stepType) {
      case ArbitrageStepType.TRADE: {
        return step.tradeStepId;
      }
      case ArbitrageStepType.WITHDRAW: {
        return step.withdrawStepId;
      }
    }
  }

  private async processTradeArbitrageStep(
    tradeStep: TradeArbitrageStep,
    arbitrage: ProcessableArbitrage,
    isLastStep: boolean
  ): Promise<ArbitrageDataStatus | null> {
    const exchange = this.getExchange(tradeStep.exchangeId);
    const tradeStepStrategyFactory = new TradeStepStrategyFactory(
      this.arbitrageRepo,
      exchange,
      tradeStep,
      arbitrage,
      isLastStep
    );
    const strategy = tradeStepStrategyFactory.getStrategy(tradeStep.status);
    const tradeStepProcessor = new TradeStepProcessor(strategy);

    return await tradeStepProcessor.process();
  }

  private async processWithdrawArbitrageStep(
    withdrawStep: WithdrawArbitrageStep,
    isLastStep: boolean
  ): Promise<ArbitrageDataStatus | null> {
    const exchanges = {
      deposit: this.getExchange(withdrawStep.exchanges.deposit.id),
      withdraw: this.getExchange(withdrawStep.exchanges.withdraw.id),
    };
    const withdrawStepStrategyFactory = new WithdrawStepStrategyFactory(
      this.arbitrageRepo,
      exchanges,
      withdrawStep,
      isLastStep
    );
    const strategy = withdrawStepStrategyFactory.getStrategy(
      withdrawStep.status
    );
    const withdrawStepProcessor = new WithdrawStepProcessor(strategy);

    return await withdrawStepProcessor.process();
  }

  private getExchange(id: string) {
    const exchange = this.exchanges.find((e) => e.id === id);

    if (!exchange) {
      throw new Error("Could not find the exchange by id:" + id);
    }

    return exchange;
  }
}
