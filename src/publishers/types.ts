export interface Publisher {
  publish(message: string, image?: Buffer): Promise<void>;
}
