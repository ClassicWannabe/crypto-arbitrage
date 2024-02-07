import {
  ArbitrageData,
  ArbitrageStepType,
  ArbitrageStatus,
  ArbitrageStep,
} from "@prisma/client";

import { ArbitrageRepo } from "../../storages/ArbitrageRepo/ArbitrageRepo.js";
import { Service } from "../types.js";
import { Address, Exchange, Order } from "../../exchanges/types.js";
import {
  ProcessableArbitrage,
  TradeArbitrageStep,
  WithdrawArbitrageStep,
} from "../../storages/ArbitrageRepo/types.js";
import { OrderStatus, TradeOperation } from "../../types.js";
import { logger } from "../../logger/logger.js";

export class MultiExchangeArbitrageProcessor implements Service {
  constructor(
    private readonly arbitrageRepo: ArbitrageRepo,
    private readonly exchanges: Exchange[]
  ) {}

  async process(): Promise<void> {
    const arbitrages = await this.arbitrageRepo.getArbitrages();
    const validArbitrages = this.filterArbitrages(arbitrages);
    await this.expireArbitrages(arbitrages);

    for (const arbitrage of validArbitrages) {
      this.processArbitrage(arbitrage);
    }
  }

  private filterArbitrages(
    arbitrages: ArbitrageData[]
  ): ProcessableArbitrage[] {
    return arbitrages.filter(this.isProcessableArbitrage);
  }

  private async expireArbitrages(arbitrages: ArbitrageData[]) {
    const expiredArbitrages = arbitrages.filter(this.isExpiredArbitrage);
    const expireArbitrageIds = expiredArbitrages.map(({ id }) => id);

    await this.arbitrageRepo.expireArbitrages(expireArbitrageIds);
  }

  private isProcessableArbitrage(
    arbitrage: ArbitrageData
  ): arbitrage is ProcessableArbitrage {
    return !this.isExpiredArbitrage(arbitrage) && arbitrage.isConfirmed;
  }

  private isExpiredArbitrage(arbitrage: ArbitrageData) {
    const tenMinutes = 10;
    const thrityMinutes = 30;
    const now = Date.now();
    const createdAt = arbitrage.createdAt.getTime();
    const passedTimeInMinutesSinceCreation = (now - createdAt) / 1000 / 60;

    if (arbitrage.status === ArbitrageStatus.PROCESSING) {
      return passedTimeInMinutesSinceCreation > thrityMinutes;
    }

    return passedTimeInMinutesSinceCreation > tenMinutes;
  }

  private async processArbitrage(arbitrage: ProcessableArbitrage) {
    for (const step of arbitrage.arbitrageSteps) {
      let updatedStep: ArbitrageStep;

      switch (step.type) {
        case ArbitrageStepType.TRADE: {
          updatedStep = await this.processTradeArbitrageStep(step, arbitrage);
          break;
        }
        case ArbitrageStepType.WITHDRAW: {
          updatedStep = (await this.processWithdrawArbitrageStep(
            step
          )) as unknown as ArbitrageStep;
          break;
        }
      }

      if (updatedStep.status === ArbitrageStatus.PROCESSING) {
        return;
      }
    }
  }

  private async processTradeArbitrageStep(
    tradeStep: TradeArbitrageStep,
    arbitrage: ProcessableArbitrage
  ): Promise<ArbitrageStep> {
    this.checkArbitrageStepStatus(tradeStep.status);
    if (tradeStep.status === ArbitrageStatus.PROCESSED) {
      return tradeStep;
    }

    if (tradeStep.status === ArbitrageStatus.PROCESSING) {
      return await this.handleProcessingTradeArbitrageStep(
        tradeStep,
        arbitrage
      );
    }

    if (tradeStep.status === ArbitrageStatus.UNTOUCHED) {
      return (await this.handleUntouchedTradeArbitrageStep(
        tradeStep,
        arbitrage
      )) as unknown as ArbitrageStep;
    }

    throw new Error("Cannot process trade step:" + tradeStep.id);
  }

  private async handleProcessingTradeArbitrageStep(
    tradeStep: TradeArbitrageStep,
    arbitrage: ProcessableArbitrage
  ): Promise<ArbitrageStep> {
    const exchange = this.getExchange(tradeStep.details.exchange);
    const orderId = tradeStep.details.orderId;
    if (!orderId) {
      throw new Error(
        `Order ID is missing in details. ArbitrageData ID: ${arbitrage.id}. Arbitrage Step ID: ${tradeStep.id}`
      );
    }
    const order = await exchange.getOrder(orderId, arbitrage.symbol);
    if (order.status === OrderStatus.OPEN) {
      return tradeStep;
    }
    if (order.status === OrderStatus.CLOSED) {
      return (await this.arbitrageRepo.updateArbitrageStep(tradeStep.id, {
        status: ArbitrageStatus.PROCESSED,
      })) as unknown as ArbitrageStep;
    }

    return (await this.arbitrageRepo.updateArbitrageStep(tradeStep.id, {
      status: ArbitrageStatus.FAILED,
      arbitrageData: { update: { status: ArbitrageStatus.FAILED } },
    })) as unknown as ArbitrageStep;
  }

  private async handleUntouchedTradeArbitrageStep(
    tradeStep: TradeArbitrageStep,
    arbitrage: ProcessableArbitrage
  ) {
    const exchange = this.getExchange(tradeStep.details.exchange);
    const balance = await exchange.getBalance();
    let order: Order;
    if (tradeStep.details.operation === TradeOperation.BUY) {
      const requiredBalance =
        tradeStep.details.amount * tradeStep.details.price;
      const quoteCurrencyBalance = balance.free[arbitrage.quoteCurrency] ?? 0;

      if (quoteCurrencyBalance < requiredBalance) {
        throw new Error(
          `Insufficient balance. Exchange: ${exchange.id}. Currency: ${arbitrage.quoteCurrency}`
        );
      }

      order = await exchange.createLimitBuyOrder(
        arbitrage.symbol,
        tradeStep.details.amount,
        tradeStep.details.price
      );
    } else {
      const requiredBalance = tradeStep.details.amount;
      const baseCurrencyBalance = balance.free[arbitrage.baseCurrency] ?? 0;

      if (baseCurrencyBalance < requiredBalance) {
        throw new Error(
          `Insufficient balance. Exchange: ${exchange.id}. Currency: ${arbitrage.baseCurrency}`
        );
      }

      order = await exchange.createLimitSellOrder(
        arbitrage.symbol,
        tradeStep.details.amount,
        tradeStep.details.price
      );
    }

    return await this.arbitrageRepo.updateArbitrageStep(tradeStep.id, {
      status: ArbitrageStatus.PROCESSING,
      details: { ...tradeStep, orderId: order.id },
      arbitrageData: { update: { status: ArbitrageStatus.PROCESSING } },
    });
  }

  private async processWithdrawArbitrageStep(
    withdrawStep: WithdrawArbitrageStep
  ) {
    this.checkArbitrageStepStatus(withdrawStep.status);
    if (withdrawStep.status === ArbitrageStatus.PROCESSED) {
      return withdrawStep;
    }

    if (withdrawStep.status === ArbitrageStatus.PROCESSING) {
      return await this.handleProcessingWithdrawArbitrageStep(withdrawStep);
    }

    if (withdrawStep.status === ArbitrageStatus.UNTOUCHED) {
      return await this.handleUntouchedWithdrawArbitrageStep(withdrawStep);
    }
    throw new Error("Cannot process withdraw step:" + withdrawStep.id);
  }

  private async handleProcessingWithdrawArbitrageStep(
    withdrawStep: WithdrawArbitrageStep
  ) {
    const { currency, exchanges } = withdrawStep.details;
    const depositExchangeId = exchanges.deposit.id;
    const depositExchange = this.getExchange(depositExchangeId);

    const deposits = await depositExchange.getDeposits();
    const foundDeposit = deposits.find((deposit) => {
      const isSameCurrency = deposit.currency === currency;
      let isSameAddress = true;
      if (deposit.addressFrom && exchanges.deposit.address) {
        isSameAddress = deposit.addressFrom === exchanges.deposit.address;
      }
      return isSameCurrency && isSameAddress;
    });

    if (!foundDeposit) {
      return withdrawStep;
    }

    return await this.arbitrageRepo.updateArbitrageStep(withdrawStep.id, {
      status: ArbitrageStatus.PROCESSED,
    });
  }

  private async handleUntouchedWithdrawArbitrageStep(
    withdrawStep: WithdrawArbitrageStep
  ) {
    const { currency, amount, exchanges, network } = withdrawStep.details;
    const withdrawExchangeId = exchanges.withdraw.id;
    const depositExchangeId = exchanges.deposit.id;
    const withdrawExchange = this.getExchange(withdrawExchangeId);
    const depositExchange = this.getExchange(depositExchangeId);

    const depositAddress = await depositExchange.getDepositAddress(currency);
    this.checkDepositNetwork(depositAddress, network);

    await withdrawExchange.withdraw(currency, amount, depositAddress.address);

    return await this.arbitrageRepo.updateArbitrageStep(withdrawStep.id, {
      status: ArbitrageStatus.PROCESSING,
      arbitrageData: {
        update: {
          status: ArbitrageStatus.PROCESSING,
        },
      },
    });
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

  private checkArbitrageStepStatus(status: ArbitrageStatus) {
    const validStatuses: ArbitrageStatus[] = [
      ArbitrageStatus.PROCESSED,
      ArbitrageStatus.PROCESSING,
      ArbitrageStatus.UNTOUCHED,
    ];

    if (validStatuses.includes(status)) {
      return;
    }

    throw new Error("Cannot process step with such status:" + status);
  }
}
