export interface Publisher {
  publish(message: string): Promise<void>;
}
