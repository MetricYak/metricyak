import type { MonitorFiringJob } from '@metricyak/queue';

export async function processMonitorFiring(job: MonitorFiringJob): Promise<void> {
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'monitor firing received',
      eventId: job.eventId,
      monitorId: job.monitorId,
      value: job.value,
    }),
  );
}
