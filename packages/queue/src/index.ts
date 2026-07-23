export type { ConnectionOptions, Job, Worker } from 'bullmq';
export { createProducerConnectionOptions, createWorkerConnectionOptions } from '@/connection.js';
export { createKafka, ensureTopics } from '@/kafka/connection.js';
export { KafkaEventsProducer } from '@/kafka/events-producer.js';
export {
  createMonitorTriggerConsumer,
  MONITOR_TRIGGER_GROUP,
  type MonitorTriggerConsumer,
  parseTriggerMessage,
  type TriggerEvent,
} from '@/kafka/monitor-trigger-consumer.js';
export { TOPIC_SPECS, TOPICS, type TopicName } from '@/kafka/topics.js';
export {
  type DirtyKey,
  InMemoryMonitorDirtyBuffer,
  type MonitorDirtyBuffer,
  RedisMonitorDirtyBuffer,
} from '@/monitor-dirty.js';
export {
  BullMonitorEvalProducer,
  BullMonitorSignalsProducer,
  type EventsProducer,
  InMemoryEventsProducer,
  InMemoryMonitorEvalProducer,
  InMemoryMonitorSignalsProducer,
  type MonitorEvalProducer,
  type MonitorSignalsProducer,
} from '@/producer.js';
export {
  computeBatchId,
  type EventBatchJob,
  MONITOR_BACKSTOP_INTERVAL_MS,
  MONITOR_BACKSTOP_QUEUE,
  MONITOR_DEBOUNCE_MS,
  MONITOR_DISPATCH_INTERVAL_MS,
  MONITOR_DISPATCH_QUEUE,
  MONITOR_DRAIN_INTERVAL_MS,
  MONITOR_DRAIN_QUEUE,
  MONITOR_EVAL_QUEUE,
  MONITOR_RELAY_INTERVAL_MS,
  MONITOR_RELAY_QUEUE,
  MONITOR_SIGNALS_QUEUE,
  type MonitorBackstopJob,
  type MonitorDispatchJob,
  type MonitorDrainJob,
  type MonitorEvalDispatch,
  type MonitorEvalJob,
  type MonitorRelayJob,
  type MonitorSignalJob,
  monitorEvalJobId,
  type StoredEvent,
} from '@/queues.js';
export {
  createMonitorBackstopWorker,
  createMonitorDispatchWorker,
  createMonitorDrainWorker,
  createMonitorEvalWorker,
  createMonitorRelayWorker,
  createMonitorSignalsWorker,
  type MonitorBackstopWorkerOptions,
  type MonitorDispatchWorkerOptions,
  type MonitorDrainWorkerOptions,
  type MonitorEvalWorkerOptions,
  type MonitorRelayWorkerOptions,
  type MonitorSignalsWorkerOptions,
  registerMonitorBackstopScheduler,
  registerMonitorDispatchScheduler,
  registerMonitorDrainScheduler,
  registerMonitorRelayScheduler,
} from '@/worker-factory.js';
