import { Check, Copy, Plus, Rocket, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  type Connector,
  createSignalSource,
  deleteSignalSource,
  listConnectors,
  listSignalSources,
  type SignalSource,
} from '@/api/signal-sources';
import {
  ConnectorForm,
  type ConnectorFormValues,
  initialValuesFor,
  toConfig,
} from '@/components/data/ConnectorForm';
import { PageContainer } from '@/components/shell/PageContainer';
import { PageHeader } from '@/components/shell/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Surface } from '@/components/ui/surface';
import { useProjectRoute } from '@/hooks/useProjectRoute';
import { ApiError } from '@/lib/api';

const STATUS_LABEL: Record<SignalSource['status'], string> = {
  awaiting_first_delivery: 'Waiting for first delivery',
  healthy: 'Receiving deployments',
  failing: 'Not working',
};

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
  const [connecting, setConnecting] = useState(false);
  const [name, setName] = useState('');
  const [values, setValues] = useState<ConnectorFormValues>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [issuedSecret, setIssuedSecret] = useState<{ source: SignalSource; secret: string } | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<SignalSource | null>(null);

  const reload = useCallback(async () => {
    const { sources: loaded } = await listSignalSources(projectId);
    setSources(loaded);
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

  return (
    <PageContainer>
      <PageHeader
        icon={Rocket}
        title="Deployments"
        description="Connect a repository so deployments show up against your metrics."
      />

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
            onChange={(field, value) => setValues((current) => ({ ...current, [field]: value }))}
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

      {!hasSources && !connecting && sources !== null ? (
        <Surface className="flex flex-col items-start gap-3 p-8">
          <Rocket className="size-6 text-muted-foreground" />
          <h2 className="font-semibold text-lg">See what shipped when a metric moves</h2>
          <p className="max-w-prose text-muted-foreground text-sm">
            Connect a repository and every deployment is recorded against your metrics.
          </p>
          <Button onClick={() => setConnecting(true)}>
            <Rocket className="size-4" />
            Connect GitHub
          </Button>
        </Surface>
      ) : null}

      {hasSources ? (
        <Surface className="flex flex-col divide-y">
          <div className="flex items-center justify-between p-4">
            <h2 className="font-semibold text-sm">Connected repositories</h2>
            <Button variant="outline" size="sm" onClick={() => setConnecting(true)}>
              <Plus className="size-4" />
              Connect another
            </Button>
          </div>
          {sources?.map((source) => (
            <div key={source.id} className="flex items-center gap-3 p-4">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-sm">{source.name}</span>
                <span className="text-muted-foreground text-xs">
                  {source.lastDeliveryAt
                    ? `Last delivery ${new Date(source.lastDeliveryAt).toLocaleString()}`
                    : 'No deliveries yet'}
                </span>
              </div>
              <Badge variant={source.status === 'healthy' ? 'secondary' : 'outline'}>
                {STATUS_LABEL[source.status]}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                aria-label={`Delete ${source.name}`}
                onClick={() => setPendingDelete(source)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </Surface>
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete ? `Delete ${pendingDelete.name}?` : ''}
        description="GitHub will keep sending until you remove the webhook there too."
        confirmLabel="Delete"
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </PageContainer>
  );
}
