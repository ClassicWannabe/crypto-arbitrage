import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

import { Publisher } from "../types.js";
import { getEnv } from "../../helpers.js";

export class EmailPublisher implements Publisher {
  private readonly client = new SNSClient();
  private topicArn: string | null = null;

  async publish(message: string) {
    const topicArn = await this.getTopicArn();

    await this.client.send(
      new PublishCommand({
        Message: message,
        TopicArn: topicArn,
      })
    );
  }

  private async getTopicArn() {
    if (this.topicArn) {
      return this.topicArn;
    }
    const ssmClient = new SSMClient();
    const parameterName = getEnv("awsSnsTopicParameterName");
    const parameter = await ssmClient.send(
      new GetParameterCommand({ Name: parameterName })
    );
    const value = parameter.Parameter?.Value;
    if (!value) {
      throw new Error("Cannot get SNS Topic ARN from Parameter Store");
    }
    this.topicArn = value;
    return value;
  }
}
