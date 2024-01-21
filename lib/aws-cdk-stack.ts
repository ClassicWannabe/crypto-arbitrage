import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { readFileSync } from "fs";

export class CryptoArbitrageStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const defaultvpc = ec2.Vpc.fromLookup(this, "vpc", { isDefault: true });

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
                "arn:aws:ssm:eu-central-1:654654636079:parameter/crypto-arbitrage/cloudwatch-config",
              ],
            }),
          ],
        }),
      },
    });

    const securityGroup = new ec2.SecurityGroup(this, "arbitrage-bot-sg", {
      vpc: defaultvpc,
      allowAllOutbound: true,
    });
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "SSH from anywhere"
    );

    const instance = new ec2.Instance(this, "arbitrage-bot", {
      vpc: defaultvpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO
      ),
      role: instanceRole,
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup,
    });

    new cdk.CfnOutput(this, "InstancePublicIp", {
      value: instance.instancePublicIp || "No public IP available",
    });

    const userDataScript = readFileSync("./lib/user-data.sh", "utf8");

    instance.addUserData(userDataScript);
  }
}
