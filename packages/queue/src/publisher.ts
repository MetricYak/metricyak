export interface EventPublisher {
  publish(topic: string, message: unknown): Promise<void>;
}
