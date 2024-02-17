const { RebootInstancesCommand } = require("@aws-sdk/client-ec2");
const { EC2Client } = require("@aws-sdk/client-ec2");

const client = new EC2Client();

exports.handler = async () => {
  const instanceId = process.env.INSTANCE_ID;
  const command = new RebootInstancesCommand({
    InstanceIds: [instanceId],
  });

  await client.send(command);
};
