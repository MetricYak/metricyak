import { ArrowLeft, BellRing } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { listMetrics } from '@/api/metrics';
import { deleteMonitor, getMonitor, type Monitor, setMonitorEnabled } from '@/api/monitors';
import { conditionSentence, formatThreshold } from '@/components/monitors/condition-sentence';
import { PageContainer } from '@/components/shell/PageContainer';
import { PageTabs } from '@/components/shell/PageTabs';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Surface } from '@/components/ui/surface';
import { Switch } from '@/components/ui/switch';
import { useProjectContext } from '@/contexts/ProjectContext';
import { cn } from '@/lib/utils';
import { MonitorStatusBadge } from './MonitorStatusBadge';

type Tab = 'overview' | 'settings';
type LoadState = 'loading' | 'ready' | 'error';

function MonitorDetailView({
  projectId,
  monitorId,
}: {
  projectId: string;
  monitorId: string;
}): React.JSX.Element {
  const navigate = useNavigate();

  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [metricName, setMetricName] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [tab, setTab] = useState<Tab>('overview');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    Promise.all([getMonitor(projectId, monitorId), listMetrics(projectId)])
      .then(([found, metrics]) => {
        if (cancelled) return;
        setMonitor(found);
        setMetricName(metrics.find((m) => m.id === found.metricId)?.name ?? null);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, monitorId]);

  const toggleEnabled = async (): Promise<void> => {
    if (!monitor) return;
    const next = !monitor.enabled;
    setMonitor({ ...monitor, enabled: next });
    try {
      await setMonitorEnabled(projectId, monitor.monitorId, next);
    } catch {
      setMonitor({ ...monitor, enabled: monitor.enabled });
      toast.error("Couldn't update the monitor");
    }
  };

  const onDelete = async (): Promise<void> => {
    if (!monitor) return;
    try {
      await deleteMonitor(projectId, monitor.monitorId);
      toast.success('Monitor deleted', { description: monitor.name });
      navigate('/monitors');
    } catch {
      toast.error("Couldn't delete the monitor");
      setConfirmDelete(false);
    }
  };

  if (state === 'error') {
    return (
      <PageContainer width="content" className="py-16">
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="font-semibold text-foreground text-sm">Couldn't load this monitor</p>
          <Button variant="outline" className="mt-2" onClick={() => navigate('/monitors')}>
            Back to monitors
          </Button>
        </div>
      </PageContainer>
    );
  }

  const title = monitor?.name ?? 'Monitor';
  const description =
    monitor && metricName != null
      ? conditionSentence({
          metricName,
          operator: monitor.condition.operator,
          value: monitor.condition.value,
          window: monitor.window,
          holdFor: monitor.holdFor,
          long: true,
        })
      : undefined;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="flex h-full flex-col">
      <PageTabs width="content">
        <nav>
          <ul className="flex items-stretch gap-6">
            {TABS.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setTab(entry.id)}
                  aria-current={tab === entry.id ? 'page' : undefined}
                  className={cn(
                    'relative flex items-center pt-1 pb-3 font-medium text-sm transition-colors',
                    tab === entry.id
                      ? 'text-brand-orange-text'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {entry.label}
                  {tab === entry.id ? (
                    <span className="-bottom-px absolute inset-x-0 h-0.5 rounded-full bg-metricyak-brand-orange" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </PageTabs>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <PageContainer width="content" className="py-6">
          <Link
            to="/monitors"
            className="mb-3 inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to monitors
          </Link>
          <div className="mb-6">
            <h1 className="flex items-center gap-2 font-semibold text-foreground text-xl">
              <BellRing className="size-5 text-metricyak-brand-orange" />
              {title}
            </h1>
            {description ? (
              <p className="mt-1 text-muted-foreground text-sm">{description}</p>
            ) : null}
          </div>
          {state === 'loading' || !monitor ? (
            <div className="h-40 animate-pulse rounded-lg bg-metricyak-100" />
          ) : tab === 'overview' ? (
            <div className="space-y-6">
              <Surface padding="lg" className="flex flex-wrap items-center justify-between gap-4">
                <MonitorStatusBadge monitor={monitor} />
                <span className="flex items-center gap-2 text-muted-foreground text-sm">
                  {monitor.enabled ? 'Enabled' : 'Paused'}
                  <Switch
                    checked={monitor.enabled}
                    onCheckedChange={toggleEnabled}
                    aria-label={monitor.enabled ? 'Disable monitor' : 'Enable monitor'}
                  />
                </span>
              </Surface>

              <Surface padding="lg" className="space-y-1">
                <p className="text-muted-foreground text-sm">Current value</p>
                <p className="font-semibold text-foreground text-2xl">
                  {monitor.lastValue != null ? formatThreshold(monitor.lastValue) : '—'}
                </p>
                <p className="text-muted-foreground text-xs">
                  {monitor.lastEvaluatedAt
                    ? `Last checked ${new Date(monitor.lastEvaluatedAt).toLocaleString()}`
                    : 'Not checked yet'}
                </p>
              </Surface>

              {monitor.evalHealth === 'error' ? (
                <Surface padding="lg" className="border-destructive/40">
                  <p className="font-medium text-destructive text-sm">Evaluation is failing</p>
                  {monitor.lastEvalError ? (
                    <p className="mt-1 text-muted-foreground text-sm">{monitor.lastEvalError}</p>
                  ) : null}
                </Surface>
              ) : null}
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-muted-foreground text-sm">
                Editing a monitor's threshold arrives with monitor versioning. For now, monitors are
                created fresh.
              </p>
              <Surface padding="lg" className="border-destructive/40">
                <h2 className="font-semibold text-foreground text-sm">Danger zone</h2>
                <p className="mt-1 text-muted-foreground text-sm">
                  Deleting a monitor stops it watching and removes it for good.
                </p>
                <Button
                  variant="destructive"
                  className="mt-4"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete monitor
                </Button>
              </Surface>
            </div>
          )}
        </PageContainer>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${monitor?.name ?? 'this monitor'}?`}
        description="It stops watching immediately. This can't be undone."
        confirmLabel="Delete monitor"
        cancelLabel="Keep it"
        destructive
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

export function MonitorDetailPage(): React.JSX.Element {
  const { activeProject } = useProjectContext();
  const projectId = activeProject?.id ?? null;
  const { monitorId } = useParams();
  const navigate = useNavigate();

  if (!projectId || !monitorId) {
    return (
      <PageContainer width="content" className="py-16">
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="font-semibold text-foreground text-sm">No monitor selected</p>
          <Button variant="outline" className="mt-2" onClick={() => navigate('/monitors')}>
            Back to monitors
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <MonitorDetailView key={`${projectId}:${monitorId}`} projectId={projectId} monitorId={monitorId} />
  );
}
