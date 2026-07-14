import type { MonitorSignalJob } from '@metricyak/queue';

export async function processMonitorSignal(job: MonitorSignalJob): Promise<void> {
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'monitor signal received',
      eventId: job.eventId,
      monitorId: job.monitorId,
      value: job.value,
    }),
  );
}
