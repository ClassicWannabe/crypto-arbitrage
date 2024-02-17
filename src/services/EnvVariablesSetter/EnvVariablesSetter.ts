import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import dotenv from "dotenv";

import { getEnv } from "../../helpers.js";

export class EnvVariablesSetter {
  private isSet = false;

  async load() {
    if (this.isSet) {
      return;
    }
    const envValue = await this.getParameterValue();
    this.setEnvValue(envValue);
  }

  private setEnvValue(envValue: string) {
    const parsedEnv = dotenv.parse(envValue);
    dotenv.populate(process.env as Record<string, string>, parsedEnv);

    this.isSet = true;
  }

  private async getParameterValue() {
    const parameter = await this.getParameter();
    const envValue = parameter.Parameter?.Value;
    if (!envValue) {
      throw new Error("cannot find env value");
    }
    return envValue;
  }

  private async getParameter() {
    const ssmClient = new SSMClient();
    const parameterName = getEnv("envParameterName");
    const parameter = await ssmClient.send(
      new GetParameterCommand({ Name: parameterName, WithDecryption: true })
    );
    return parameter;
  }
}
