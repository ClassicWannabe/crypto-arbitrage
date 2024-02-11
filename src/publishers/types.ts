export interface Publisher {
  publish(message: string, options?: any): Promise<void>;
}
