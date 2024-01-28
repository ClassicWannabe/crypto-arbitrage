import {
  PrismaClient,
  ArbitrageStepType,
  Prisma,
  ArbitrageStatus,
} from "@prisma/client";

import {
  TradeArbitrageStepDetails,
  WithdrawArbitrageStepDetails,
} from "../types.js";
import {
  tradeArbitrageStepDetails,
  withdrawArbitrageStepDetails,
} from "../schema.js";
import { ProcessableArbitrage, ProcessableArbitrageStatus } from "./types.js";

export class ArbitrageRepo {
  constructor(private readonly client: PrismaClient) {}

  async getArbitrages(): Promise<ProcessableArbitrage[]> {
    const statusIn: ProcessableArbitrageStatus[] = [
      ArbitrageStatus.UNTOUCHED,
      ArbitrageStatus.PROCESSING,
    ];
    const arbitrageDataCollection = await this.client.arbitrageData.findMany({
      where: { status: { in: statusIn } },
      include: {
        arbitrageSteps: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    return arbitrageDataCollection.map((data) => {
      return {
        ...data,
        arbitrageSteps: data.arbitrageSteps.map((step) => ({
          ...step,
          details: this.parseStepDetails(step.type, step.details),
        })),
      };
    }) as ProcessableArbitrage[];
  }

  async saveArbitrage(
    arbitrageData: Prisma.ArbitrageDataCreateInput,
    steps: (Omit<
      Prisma.ArbitrageStepCreateManyInput,
      "arbitrageDataId" | "order" | "details"
    > & { details: TradeArbitrageStepDetails | WithdrawArbitrageStepDetails })[]
  ) {
    steps.forEach((step) => {
      this.parseStepDetails(step.type, step.details);
    });

    const savedArbitrageData = await this.client.arbitrageData.create({
      data: arbitrageData,
    });

    const stepsInput = steps.map((step, index) => ({
      arbitrageDataId: savedArbitrageData.id,
      order: index + 1,
      ...step,
    }));
    await this.client.arbitrageStep.createMany({ data: stepsInput });
  }

  private parseStepDetails(type: ArbitrageStepType, details: unknown) {
    switch (type) {
      case ArbitrageStepType.TRADE: {
        return tradeArbitrageStepDetails.parse(details);
      }
      case ArbitrageStepType.WITHDRAW: {
        return withdrawArbitrageStepDetails.parse(details);
      }
    }

    throw new Error("Uknown step type:" + type);
  }

  async expireArbitrages(ids: string[]) {
    await this.client.arbitrageData.updateMany({
      data: { status: ArbitrageStatus.EXPIRED },
      where: {
        id: { in: ids },
      },
    });
  }

  async updateArbitrageStep(id: string, data: Prisma.ArbitrageStepUpdateInput) {
    const step = await this.client.arbitrageStep.update({
      data,
      where: { id },
    });

    return { ...step, details: this.parseStepDetails(step.type, step.details) };
  }

  async updateArbitrageData(id: string, data: Prisma.ArbitrageDataUpdateInput) {
    return await this.client.arbitrageData.update({
      data,
      where: { id },
    });
  }
}
