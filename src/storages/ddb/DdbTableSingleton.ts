import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Service } from "electrodb";

import { DDB_LOCAL_ENDPOINT, DDB_TABLE_NAME } from "../../consts.js";
import { ArbitrageDataEntity } from "./entities/ArbitrageDataEntity.js";
import { TradeStepEntity } from "./entities/TradeStepEntity.js";
import { WithdrawStepEntity } from "./entities/WithdrawStepEntity.js";
import { ArbitrageService } from "./types.js";

export class DdbTableSingleton {
  private static table: ArbitrageService;

  private constructor() {}

  static getTable() {
    if (this.table) {
      return this.table;
    }

    const client = new DynamoDBClient({
      endpoint: DDB_LOCAL_ENDPOINT,
    });

    this.table = new Service(
      {
        arbitrageData: ArbitrageDataEntity,
        tradeStep: TradeStepEntity,
        withdrawStep: WithdrawStepEntity,
      },
      {
        client,
        table: DDB_TABLE_NAME,
      }
    );

    return this.table;
  }
}
