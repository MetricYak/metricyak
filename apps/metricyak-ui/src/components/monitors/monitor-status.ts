import type { Monitor } from '@/api/monitors';

export type MonitorStatusTone = 'ok' | 'firing' | 'pending' | 'error' | 'muted';

export type MonitorStatusView = {
  label: string;
  tone: MonitorStatusTone;
};

export function deriveMonitorStatus(
  monitor: Pick<Monitor, 'enabled' | 'evalHealth' | 'status'>,
): MonitorStatusView {
  if (!monitor.enabled) return { label: 'Paused', tone: 'muted' };
  if (monitor.evalHealth === 'error') return { label: 'Error', tone: 'error' };
  if (monitor.status == null) return { label: 'Watching', tone: 'ok' };
  switch (monitor.status) {
    case 'firing':
      return { label: 'Firing', tone: 'firing' };
    case 'pending':
      return { label: 'Pending', tone: 'pending' };
    case 'ok':
      return { label: 'Watching', tone: 'ok' };
    default: {
      const _exhaustive: never = monitor.status;
      throw new Error(`Unhandled status: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
