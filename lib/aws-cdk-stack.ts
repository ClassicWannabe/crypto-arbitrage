import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { readFileSync } from "fs";

export class AwsCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const defaultvpc = ec2.Vpc.fromLookup(this, "vpc", { isDefault: true });
    const codeInS3 = new s3.Bucket(
      this,
      "crypto-arbitrage-source-code-bucket",
      {
        encryption: s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true,
        versioned: false,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }
    );

    const instanceRole = new iam.Role(this, "arbitrage-bot-role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore"
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3ReadOnlyAccess"),
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
              ],
            }),
          ],
        }),
      },
    });

    const keyPair = ec2.KeyPair.fromKeyPairAttributes(this, "KeyPair", {
      keyPairName: "crypto-arbitrage",
      type: ec2.KeyPairType.RSA,
    });

    const instance = new ec2.Instance(this, "arbitrage-bot", {
      vpc: defaultvpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO
      ),
      role: instanceRole,
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      keyPair,
    });

    new cdk.CfnOutput(this, "InstancePublicIp", {
      value: instance.instancePublicIp || "No public IP available",
    });

    const userDataScript = readFileSync("./lib/user-data.sh", "utf8");

    instance.addUserData(userDataScript);
  }
}
