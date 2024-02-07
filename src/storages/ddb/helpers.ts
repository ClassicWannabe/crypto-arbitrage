import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Service } from "electrodb";

import { DDB_LOCAL_ENDPOINT, DDB_TABLE_NAME } from "../../consts.js";
import { ArbitrageDataEntity } from "./entities/ArbitrageDataEntity.js";
import { TradeStepEntity } from "./entities/TradeStepEntity.js";
import { WithdrawStepEntity } from "./entities/WithdrawStepEntity.js";

export const getConfirmationCode = () => {
  const num = Math.round(Math.random() * 10 ** 6);

  return num.toString().padStart(6, "0");
};

export const getTable = () => {
  const client = new DynamoDBClient({
    endpoint: DDB_LOCAL_ENDPOINT,
  });

  return new Service(
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
};
