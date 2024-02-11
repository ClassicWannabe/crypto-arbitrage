import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Service } from "electrodb";

import { ENV } from "../../consts.js";
import { ArbitrageDataEntity } from "./entities/ArbitrageDataEntity.js";
import { TradeStepEntity } from "./entities/TradeStepEntity.js";
import { WithdrawStepEntity } from "./entities/WithdrawStepEntity.js";
import { ArbitrageService } from "./types.js";
import { getEnv } from "../../helpers.js";

export class DdbTableSingleton {
  private static table: ArbitrageService;

  private constructor() {}

  static getTable() {
    if (this.table) {
      return this.table;
    }

    const client = new DynamoDBClient({
      region: getEnv("awsRegion"),
      endpoint: ENV.ddbLocalEndpoint,
    });

    const tableName = getEnv("ddbTableName");

    this.table = new Service(
      {
        arbitrageData: ArbitrageDataEntity,
        tradeStep: TradeStepEntity,
        withdrawStep: WithdrawStepEntity,
      },
      {
        client,
        table: tableName,
      }
    );

    return this.table;
  }
}
