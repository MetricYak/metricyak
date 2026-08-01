import { Check, Copy, Plus, Rocket, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  type Connector,
  createSignalSource,
  deleteSignalSource,
  listConnectors,
  listSignalSources,
  type SignalSource,
  type SignalSourceStatus,
} from '@/api/signal-sources';
import {
  ConnectorForm,
  type ConnectorFormValues,
  initialValuesFor,
  toConfig,
} from '@/components/data/ConnectorForm';
import { DeploymentSourcesTable } from '@/components/data/DeploymentSourcesTable';
import { DeploymentsEmptyState } from '@/components/data/DeploymentsEmptyState';
import { matchesSourceQuery } from '@/components/data/deployment-source-view';
import { PageContainer } from '@/components/shell/PageContainer';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Surface } from '@/components/ui/surface';
import { useProjectRoute } from '@/hooks/useProjectRoute';
import { ApiError } from '@/lib/api';

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'healthy', label: 'Receiving' },
  { value: 'awaiting_first_delivery', label: 'Waiting' },
  { value: 'failing', label: 'Not working' },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]['value'];

function matchesStatusFilter(status: SignalSourceStatus, filter: StatusFilter): boolean {
  return filter === 'all' || status === filter;
}

function CopyField({ label, value }: { label: string; value: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [value]);

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button type="button" variant="outline" onClick={copy} aria-label={`Copy ${label}`}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

export function DeploymentsPage(): React.JSX.Element {
  const { projectId } = useProjectRoute();
  const [connector, setConnector] = useState<Connector | null>(null);
  const [sources, setSources] = useState<SignalSource[] | null>(null);
  // "3 hours ago" is measured from the moment the list was fetched, so a reload refreshes it.
  const [loadedAt, setLoadedAt] = useState(() => new Date());
  const [connecting, setConnecting] = useState(false);
  const [name, setName] = useState('');
  const [values, setValues] = useState<ConnectorFormValues>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [issuedSecret, setIssuedSecret] = useState<{ source: SignalSource; secret: string } | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<SignalSource | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const reload = useCallback(async () => {
    setLoadFailed(false);
    try {
      const { sources: loaded } = await listSignalSources(projectId);
      setSources(loaded);
      setLoadedAt(new Date());
    } catch {
      setLoadFailed(true);
    }
  }, [projectId]);

  useEffect(() => {
    void listConnectors().then(({ connectors }) => {
      const github = connectors.find((entry) => entry.provider === 'github') ?? null;
      setConnector(github);
      if (github) setValues(initialValuesFor(github.configSchema));
    });
    void reload();
  }, [reload]);

  const submit = useCallback(async () => {
    if (!connector) return;
    setSaving(true);
    setFieldErrors({});
    try {
      const created = await createSignalSource(projectId, {
        name: name.trim(),
        provider: connector.provider,
        config: toConfig(connector.configSchema, values),
      });
      setIssuedSecret({ source: created.source, secret: created.secret });
      setConnecting(false);
      setName('');
      setValues(initialValuesFor(connector.configSchema));
      await reload();
    } catch (error) {
      if (error instanceof ApiError) {
        const byField: Record<string, string> = {};
        for (const item of error.errors) {
          if (item.attribute) byField[item.attribute] = item.message;
        }
        setFieldErrors(byField);
        if (Object.keys(byField).length === 0) toast.error(error.message);
      } else {
        toast.error('Could not connect that repository.');
      }
    } finally {
      setSaving(false);
    }
  }, [connector, name, projectId, reload, values]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    await deleteSignalSource(projectId, pendingDelete.id);
    setPendingDelete(null);
    await reload();
  }, [pendingDelete, projectId, reload]);

  const hasSources = sources !== null && sources.length > 0;
  const isLoading = sources === null && !loadFailed;
  const showHero = !hasSources && !connecting && !isLoading && !loadFailed && !issuedSecret;
  const showTable = !loadFailed;
  const filtersActive = query.trim().length > 0 || statusFilter !== 'all';

  const visibleSources = useMemo(
    () =>
      (sources ?? []).filter(
        (source) =>
          matchesSourceQuery(source, query) && matchesStatusFilter(source.status, statusFilter),
      ),
    [sources, query, statusFilter],
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Rocket}
        title="Deployments"
        width="wide"
        description="Every deploy we receive becomes a marker on this project’s metric charts."
        actions={
          <Button className="raised" onClick={() => setConnecting(true)}>
            <Plus className="size-4" />
            New source
          </Button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PageContainer width="wide" className="flex min-h-full flex-col gap-6 py-6">
          {issuedSecret ? (
            <Surface className="flex flex-col gap-4 p-5">
              <div className="flex flex-col gap-1">
                <h2 className="font-semibold text-base">Finish in GitHub</h2>
                <p className="text-muted-foreground text-sm">
                  Add a webhook to {issuedSecret.source.name} with these two values, content type{' '}
                  <span className="font-mono">application/json</span>, and the{' '}
                  <span className="font-medium">Deployment statuses</span> event.
                </p>
              </div>
              <CopyField label="Payload URL" value={issuedSecret.source.webhookUrl} />
              <CopyField label="Secret" value={issuedSecret.secret} />
              <p className="text-muted-foreground text-xs">
                The secret is shown once. If you lose it, delete this connection and make another.
              </p>
              <Button className="self-start" onClick={() => setIssuedSecret(null)}>
                Done
              </Button>
            </Surface>
          ) : null}

          {connecting && connector ? (
            <Surface className="flex flex-col gap-4 p-5">
              <h2 className="font-semibold text-base">Connect a GitHub repository</h2>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="source-name">Name</Label>
                <Input
                  id="source-name"
                  value={name}
                  placeholder="acme/web"
                  onChange={(event) => setName(event.target.value)}
                />
                <p className="text-muted-foreground text-xs">What to call this connection.</p>
              </div>
              <ConnectorForm
                schema={connector.configSchema}
                values={values}
                errors={fieldErrors}
                onChange={(field, value) =>
                  setValues((current) => ({ ...current, [field]: value }))
                }
              />
              <div className="flex gap-2">
                <Button onClick={() => void submit()} disabled={saving || name.trim().length === 0}>
                  {saving ? 'Connecting…' : 'Connect repository'}
                </Button>
                <Button variant="ghost" onClick={() => setConnecting(false)}>
                  Cancel
                </Button>
              </div>
            </Surface>
          ) : null}

          {loadFailed ? (
            <Surface className="flex flex-col items-center gap-3 p-10 text-center">
              <h2 className="font-semibold text-base">Couldn’t load your deployment sources</h2>
              <p className="max-w-[46ch] text-pretty text-muted-foreground text-sm">
                The connection to MetricYak dropped. Your sources are safe — this page just couldn’t
                reach them.
              </p>
              <Button variant="outline" onClick={() => void reload()}>
                Try again
              </Button>
            </Surface>
          ) : null}

          {showHero ? <DeploymentsEmptyState onConnect={() => setConnecting(true)} /> : null}

          {showTable ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              {hasSources ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search sources"
                      aria-label="Search sources"
                      className="h-9 w-56 pl-8"
                    />
                  </div>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                  >
                    <SelectTrigger className="h-9 w-44" size="sm" aria-label="Filter by status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_FILTERS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <DeploymentSourcesTable
                sources={visibleSources}
                filtersActive={filtersActive}
                isLoading={isLoading}
                now={loadedAt}
                onDelete={setPendingDelete}
              />
            </div>
          ) : null}
        </PageContainer>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete ? `Delete ${pendingDelete.name}?` : ''}
        description="GitHub will keep sending until you remove the webhook there too."
        confirmLabel="Delete"
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
