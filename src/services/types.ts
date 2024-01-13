export interface Service {
  process(): Promise<void>;
}
