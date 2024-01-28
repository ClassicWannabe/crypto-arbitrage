import { Publisher } from "../types.js";

export class EmailPublisher implements Publisher {
  async publish(message: string, image?: Buffer | undefined) {}
}
