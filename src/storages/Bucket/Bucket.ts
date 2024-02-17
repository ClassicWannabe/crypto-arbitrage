import {
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export class Bucket {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string
  ) {}

  async put(key: string, data: unknown) {
    const dataString = JSON.stringify(data);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: dataString,
    });

    await this.client.send(command);
  }

  async get(key: string): Promise<unknown | null> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });

    const response = await this.client.send(command);
    const data = response.Body;
    if (!data) {
      return null;
    }
    const stringData = await data.transformToString();

    return JSON.parse(stringData);
  }
}
