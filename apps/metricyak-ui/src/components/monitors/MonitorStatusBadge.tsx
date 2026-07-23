import type { Monitor } from '@/api/monitors';
import { deriveMonitorStatus, type MonitorStatusTone } from './monitor-status';

const DOT_CLASS: Record<MonitorStatusTone, string> = {
  ok: 'bg-emerald-500',
  firing: 'bg-metricyak-brand-orange',
  pending: 'bg-amber-500',
  error: 'bg-destructive',
  muted: 'bg-metricyak-400',
};

export function MonitorStatusBadge({
  monitor,
}: {
  monitor: Pick<Monitor, 'enabled' | 'evalHealth' | 'status'>;
}): React.JSX.Element {
  const view = deriveMonitorStatus(monitor);
  return (
    <span className="flex items-center gap-2">
      <span className={`size-2 rounded-full ${DOT_CLASS[view.tone]}`} />
      <span className="font-medium text-sm">{view.label}</span>
    </span>
  );
}
