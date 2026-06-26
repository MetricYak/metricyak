import type { EventBatchJob, Job } from '@metricyak/queue';
import type { EventsRepository } from '@metricyak/storage';

export async function processEventBatch(
  job: Job<EventBatchJob>,
  eventsRepo: EventsRepository,
): Promise<void> {
  const { projectId, events } = job.data;

  const rows = events.map((e) => ({
    id: e.id,
    projectId,
    name: e.name,
    timestamp: new Date(e.timestamp),
    properties: e.properties,
  }));

  await eventsRepo.insertBatch(rows);
}
