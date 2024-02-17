import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sns from "aws-cdk-lib/aws-sns";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as customResources from "aws-cdk-lib/custom-resources";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as events from "aws-cdk-lib/aws-events";
import * as eventsTargets from "aws-cdk-lib/aws-events-targets";
import { Construct } from "constructs";
import { readFileSync } from "fs";
import path from "path";
import url from "url";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import dotenv from "dotenv";
import { RetentionDays } from "aws-cdk-lib/aws-logs";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EMAIL_SUBSCRIPTIONS = [
  "ryeleussinov@gmail.com",
  "zhurinbaev.azamat@gmail.com",
];

export class CryptoArbitrageStack extends cdk.Stack {
  // private bucket: s3.Bucket;
  private snsTopic: sns.Topic;
  private snsTopicArnParameter: ssm.StringParameter;
  private cloudwatchConfigParameter: ssm.StringParameter;
  private codeUpdateScriptParameter: ssm.StringParameter;
  private ddbTable: dynamodb.Table;
  private instanceRole: iam.Role;
  private vpc: cdk.aws_ec2.IVpc;
  private instance: ec2.Instance;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // this.createBucket();
    // this.createMarketLoaderLambda();
    this.createSnsTopic();
    this.createDdbTable();
    this.createParameters();
    this.createInstanceRole();
    this.setVpc();
    this.createInstance();
    this.createInstanceRebootCustomResources();
  }

  // private createBucket() {
  //   const bucket = new s3.Bucket(this, "exchange-markets-bucket", {
  //     versioned: false,
  //     removalPolicy: cdk.RemovalPolicy.DESTROY,
  //   });

  //   this.bucket = bucket;
  // }

  // private createMarketLoaderLambda() {
  //   const role = new iam.Role(this, "market-loader-lambda-role", {
  //     assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
  //     managedPolicies: [
  //       iam.ManagedPolicy.fromAwsManagedPolicyName(
  //         "service-role/AWSLambdaBasicExecutionRole"
  //       ),
  //     ],
  //     inlinePolicies: {
  //       parameterStore: new iam.PolicyDocument({
  //         statements: [
  //           new iam.PolicyStatement({
  //             actions: ["ssm:DescribeParameters"],
  //             resources: ["*"],
  //           }),
  //           new iam.PolicyStatement({
  //             actions: ["ssm:GetParameters", "ssm:GetParameter"],
  //             resources: [
  //               "arn:aws:ssm:eu-central-1:654654636079:parameter/crypto-arbitrage/env",
  //             ],
  //           }),
  //         ],
  //       }),
  //     },
  //   });
  //   this.bucket.grantReadWrite(role);
  //   const marketLoaderLambda = new NodejsFunction(
  //     this,
  //     "market-loader-lambda",
  //     {
  //       role,
  //       handler: "main",
  //       entry: path.resolve(__dirname, "../src/scripts/runMarketLoader.ts"),
  //       timeout: cdk.Duration.minutes(2),
  //       runtime: lambda.Runtime.NODEJS_20_X,
  //       memorySize: 512,
  //       bundling: {
  //         tsconfig: path.resolve(__dirname, "../tsconfig.json"),
  //         format: OutputFormat.ESM,
  //         sourceMap: true,
  //         banner:
  //           "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  //       },
  //       environment: {
  //         AWS_S3_BUCKET_NAME: this.bucket.bucketName,
  //         ENV_PARAMETER_NAME: "/crypto-arbitrage/env",
  //       },
  //       logRetention: RetentionDays.ONE_WEEK,
  //     }
  //   );

  //   const eventRule = new events.Rule(this, "10-minute-rule-event-bridge", {
  //     schedule: events.Schedule.rate(cdk.Duration.minutes(10)),
  //   });

  //   eventRule.addTarget(
  //     new eventsTargets.LambdaFunction(marketLoaderLambda, { retryAttempts: 1 })
  //   );
  // }

  private createSnsTopic() {
    const snsTopic = new sns.Topic(this, "confirmation-code-sender-sns");

    for (const email of EMAIL_SUBSCRIPTIONS) {
      new sns.Subscription(this, `email-subscription-${email}`, {
        topic: snsTopic,
        protocol: cdk.aws_sns.SubscriptionProtocol.EMAIL,
        endpoint: email,
      });
    }

    this.snsTopic = snsTopic;
  }

  private createDdbTable() {
    const ddbTable = new dynamodb.Table(this, "crypto-arbitrage-ddb-table", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 25,
      writeCapacity: 25,
      tableName: "crypto-arbitrage",
      timeToLiveAttribute: "expireAt",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.ddbTable = ddbTable;
  }

  private createParameters() {
    const snsTopicParameter = new ssm.StringParameter(
      this,
      "email-topic-arn-parameter",
      {
        stringValue: this.snsTopic.topicArn,
        parameterName: "/crypto-arbitrage/email-topic-arn",
      }
    );
    this.snsTopicArnParameter = snsTopicParameter;

    const cloudwatchConfig = readFileSync(
      path.resolve(__dirname, "./cloudwatch-config.json"),
      "utf-8"
    );
    const cloudwatchConfigParameter = new ssm.StringParameter(
      this,
      "cloudwatch-config-parameter",
      {
        stringValue: cloudwatchConfig,
        parameterName: "/crypto-arbitrage/cloudwatch-config",
      }
    );
    this.cloudwatchConfigParameter = cloudwatchConfigParameter;

    const codeUpdateScript = readFileSync(
      path.resolve(__dirname, "./code-update.sh"),
      "utf-8"
    );
    const codeUpdateScriptParameter = new ssm.StringParameter(
      this,
      "code-update-script-parameter",
      {
        stringValue: codeUpdateScript,
        parameterName: "/crypto-arbitrage/code-update-script",
      }
    );
    this.codeUpdateScriptParameter = codeUpdateScriptParameter;
  }

  private createInstanceRebootCustomResources() {
    const rebootFunction = new lambda.Function(
      this,
      "reboot-instance-function",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "rebootEC2.handler",
        code: lambda.Code.fromAsset(path.resolve(__dirname, "./rebootEC2")),
        timeout: cdk.Duration.seconds(60),
        environment: {
          INSTANCE_ID: this.instance.instanceId,
        },
      }
    );

    rebootFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ec2:RebootInstances"],
        resources: ["*"],
      })
    );

    const customResourceRole = new iam.Role(
      this,
      `reboot-instance-custom-resource-role`,
      {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      }
    );
    customResourceRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["lambda:InvokeFunction"],
        resources: ["*"],
      })
    );

    new customResources.AwsCustomResource(
      this,
      "reboot-instance-custom-resource",
      {
        onUpdate: {
          service: "Lambda",
          action: "invoke",
          parameters: {
            FunctionName: rebootFunction.functionArn,
          },
          physicalResourceId: customResources.PhysicalResourceId.of(
            "reboot-resource" + new Date().toISOString()
          ),
        },
        role: customResourceRole,
      }
    );
  }

  private createInstanceRole() {
    const instanceRole = new iam.Role(this, "arbitrage-bot-role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore"
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3ReadOnlyAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "CloudWatchAgentServerPolicy"
        ),
      ],
      inlinePolicies: {
        parameterStore: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["ssm:DescribeParameters"],
              resources: ["*"],
            }),
            new iam.PolicyStatement({
              actions: ["ssm:GetParameters"],
              resources: [
                "arn:aws:ssm:eu-central-1:654654636079:parameter/crypto-arbitrage/env",
                "arn:aws:ssm:eu-central-1:654654636079:parameter/github/deploy-key",
                this.cloudwatchConfigParameter.parameterArn,
                this.codeUpdateScriptParameter.parameterArn,
                this.snsTopicArnParameter.parameterArn,
              ],
            }),
          ],
        }),
        ddb: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                "dynamodb:BatchGet*",
                "dynamodb:DescribeStream",
                "dynamodb:DescribeTable",
                "dynamodb:Get*",
                "dynamodb:Query",
                "dynamodb:Scan",
                "dynamodb:BatchWrite*",
                "dynamodb:Delete*",
                "dynamodb:Update*",
                "dynamodb:PutItem",
              ],
              resources: [this.ddbTable.tableArn],
            }),
          ],
        }),
        sns: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["sns:Publish"],
              resources: [this.snsTopic.topicArn],
            }),
          ],
        }),
      },
    });

    this.instanceRole = instanceRole;
  }

  private setVpc() {
    const defaultvpc = ec2.Vpc.fromLookup(this, "vpc", { isDefault: true });

    this.vpc = defaultvpc;
  }

  private createInstance() {
    const securityGroup = new ec2.SecurityGroup(this, "arbitrage-bot-sg", {
      vpc: this.vpc,
      allowAllOutbound: true,
    });

    const instance = new ec2.Instance(this, "arbitrage-bot", {
      vpc: this.vpc,
      availabilityZone: "eu-central-1a",
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO
      ),
      role: this.instanceRole,
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup,
    });

    const userDataScript = readFileSync(
      path.resolve(__dirname, "./user-data.sh"),
      "utf8"
    );

    instance.addUserData(userDataScript);

    this.instance = instance;
  }
}
