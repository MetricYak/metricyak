import type { Consumer, Kafka } from 'kafkajs';
import { TOPICS } from '@/kafka/topics.js';

export const MONITOR_TRIGGER_GROUP = 'monitor-trigger';

export type TriggerEvent = { projectId: string; name: string };

export type MonitorTriggerConsumerDeps = {
  onBatch: (events: readonly TriggerEvent[]) => Promise<void>;
};

export type MonitorTriggerConsumer = {
  start(): Promise<void>;
  stop(): Promise<void>;
};

export function parseTriggerMessage(value: Buffer | null): TriggerEvent | null {
  if (!value) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value.toString());
  } catch {
    return null;
  }
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'projectId' in parsed &&
    'name' in parsed &&
    typeof parsed.projectId === 'string' &&
    typeof parsed.name === 'string'
  ) {
    return { projectId: parsed.projectId, name: parsed.name };
  }
  return null;
}

export function createMonitorTriggerConsumer(
  kafka: Kafka,
  deps: MonitorTriggerConsumerDeps,
): MonitorTriggerConsumer {
  const consumer: Consumer = kafka.consumer({ groupId: MONITOR_TRIGGER_GROUP });
  return {
    async start(): Promise<void> {
      await consumer.connect();
      await consumer.subscribe({ topic: TOPICS.eventsRaw, fromBeginning: false });
      await consumer.run({
        eachBatch: async ({ batch, resolveOffset, heartbeat }) => {
          const events: TriggerEvent[] = [];
          for (const message of batch.messages) {
            const triggerEvent = parseTriggerMessage(message.value);
            if (triggerEvent) events.push(triggerEvent);
            resolveOffset(message.offset);
          }
          await deps.onBatch(events);
          await heartbeat();
        },
      });
    },
    async stop(): Promise<void> {
      await consumer.disconnect();
    },
  };
}
