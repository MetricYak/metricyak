import { AlertTriangle, KeyRound, Loader2, Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type CreatedProjectKey,
  createProjectKey,
  listProjectKeys,
  type ProjectKey,
  revokeProjectKey,
} from '@/api/project-keys';
import { useProjectContext } from '@/contexts/ProjectContext';
import { cn } from '@/lib/utils';
import { CopyButton } from '../CopyButton';
import { SettingsDialog } from '../SettingsDialog';

const NAME_MAX = 128;

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function byNewest(a: ProjectKey, b: ProjectKey): number {
  return b.createdAt.localeCompare(a.createdAt);
}

// ─── Primary button ───────────────────────────────────────────────────────────

function PrimaryButton({
  children,
  busy,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }): React.JSX.Element {
  return (
    <button
      {...props}
      className={cn(
        'raised inline-flex items-center justify-center gap-1.5 rounded-md',
        'bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground',
        'disabled:cursor-not-allowed disabled:opacity-50',
        props.className,
      )}
    >
      {busy && <Loader2 className="size-3.5 animate-spin" />}
      {children}
    </button>
  );
}

// ─── Create dialog (name → reveal-once) ────────────────────────────────────────

function CreateKeyDialog({
  open,
  projectId,
  onClose,
  onCreated,
}: {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onCreated: (key: CreatedProjectKey) => void;
}): React.JSX.Element {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedProjectKey | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setCreating(false);
    setError(null);
    setCreated(null);
    const id = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [open]);

  const submit = async (): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    setError(null);
    try {
      const key = await createProjectKey(projectId, trimmed);
      setCreated(key);
      onCreated(key);
    } catch {
      setError('Could not create the key. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const revealing = created != null;
  const canSubmit = name.trim().length > 0 && !creating;

  return (
    <SettingsDialog
      open={open}
      onClose={onClose}
      dismissable={!revealing && !creating}
      title={revealing ? 'Project key created' : 'Create project key'}
      description={
        revealing
          ? undefined
          : 'Publishable keys let your apps and services send events to this project.'
      }
      footer={
        revealing ? (
          <PrimaryButton type="button" onClick={onClose}>
            Done
          </PrimaryButton>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
            <PrimaryButton
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit}
              busy={creating}
            >
              {creating ? 'Creating…' : 'Create key'}
            </PrimaryButton>
          </>
        )
      }
    >
      {revealing ? (
        <div className="pb-1">
          <p className="text-sm text-muted-foreground">
            Copy your key now. MetricYak stores it hashed, so it won&rsquo;t be shown again — you
            can always create a new one.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-metricyak-50 p-2.5">
            <code className="min-w-0 flex-1 select-all break-all font-mono text-[13px] leading-relaxed text-foreground">
              {created.key}
            </code>
            <CopyButton
              value={created.key}
              label="Copy project key"
              className="shrink-0 rounded-md border border-input bg-background px-2 py-1"
            >
              Copy
            </CopyButton>
          </div>
        </div>
      ) : (
        <div className="pb-1">
          <label htmlFor="new-key-name" className="text-sm font-medium text-foreground">
            Key name
          </label>
          <input
            ref={inputRef}
            id="new-key-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit) void submit();
            }}
            placeholder="e.g. Production web"
            maxLength={NAME_MAX}
            autoComplete="off"
            disabled={creating}
            aria-invalid={error != null}
            className={cn(
              'mt-2 w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm',
              'placeholder:text-muted-foreground',
              'focus:border-metricyak-brand-orange focus:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-destructive',
            )}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            A label to recognize this key later. It doesn&rsquo;t affect how the key works.
          </p>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>
      )}
    </SettingsDialog>
  );
}

// ─── Revoke dialog (type-to-confirm) ───────────────────────────────────────────

function RevokeKeyDialog({
  target,
  projectId,
  onClose,
  onRevoked,
}: {
  target: ProjectKey | null;
  projectId: string;
  onClose: () => void;
  onRevoked: (keyId: string) => void;
}): React.JSX.Element {
  const [confirmText, setConfirmText] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!target) return;
    setConfirmText('');
    setRevoking(false);
    setError(null);
    const id = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [target]);

  const confirmed = target != null && confirmText.trim() === target.name;

  const submit = async (): Promise<void> => {
    if (!target || !confirmed || revoking) return;
    setRevoking(true);
    setError(null);
    try {
      await revokeProjectKey(projectId, target.id);
      onRevoked(target.id);
    } catch {
      setError('Could not revoke the key. Please try again.');
      setRevoking(false);
    }
  };

  return (
    <SettingsDialog
      open={target != null}
      onClose={onClose}
      dismissable={!revoking}
      title="Revoke project key"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={revoking}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!confirmed || revoking}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
              'bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {revoking && <Loader2 className="size-3.5 animate-spin" />}
            {revoking ? 'Revoking…' : 'Revoke key'}
          </button>
        </>
      }
    >
      {target && (
        <div className="pb-1">
          <div className="flex gap-2.5 rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-sm text-foreground">
              Revoking <span className="font-semibold">{target.name}</span> takes effect
              immediately. Anything still using this key will stop sending events right away. This
              can&rsquo;t be undone.
            </p>
          </div>

          <label htmlFor="revoke-confirm" className="mt-4 block text-sm text-foreground">
            Type <span className="font-semibold">{target.name}</span> to confirm.
          </label>
          <input
            ref={inputRef}
            id="revoke-confirm"
            type="text"
            value={confirmText}
            onChange={(e) => {
              setConfirmText(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && confirmed) void submit();
            }}
            autoComplete="off"
            disabled={revoking}
            aria-invalid={error != null}
            className={cn(
              'mt-2 w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm',
              'placeholder:text-muted-foreground',
              'focus:border-metricyak-brand-orange focus:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-destructive',
            )}
          />
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>
      )}
    </SettingsDialog>
  );
}

// ─── Key row ───────────────────────────────────────────────────────────────────

function KeyRow({
  keyItem,
  onRevoke,
}: {
  keyItem: ProjectKey;
  onRevoke: (key: ProjectKey) => void;
}): React.JSX.Element {
  const revoked = keyItem.revokedAt != null;
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <div className={cn('flex min-w-0 items-center gap-3', revoked && 'opacity-60')}>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-metricyak-100 text-muted-foreground">
          <KeyRound className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{keyItem.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {revoked
              ? `Revoked ${formatDate(keyItem.revokedAt as string)}`
              : `Created ${formatDate(keyItem.createdAt)}`}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center">
        {revoked ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            Revoked
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onRevoke(keyItem)}
            className="rounded-md px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            Revoke
          </button>
        )}
      </div>
    </li>
  );
}

function SkeletonRow(): React.JSX.Element {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="size-8 shrink-0 animate-pulse rounded-md bg-sidebar-accent" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-40 animate-pulse rounded bg-sidebar-accent" />
        <div className="h-3 w-24 animate-pulse rounded bg-sidebar-accent" />
      </div>
    </li>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function ProjectKeysPage(): React.JSX.Element {
  const { activeProject } = useProjectContext();
  const projectId = activeProject?.id ?? null;

  const [keys, setKeys] = useState<ProjectKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ProjectKey | null>(null);
  const loadIdRef = useRef(0);

  const load = useCallback(async (id: string): Promise<void> => {
    const loadId = ++loadIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await listProjectKeys(id);
      if (loadId !== loadIdRef.current) return;
      setKeys([...result].sort(byNewest));
    } catch {
      if (loadId !== loadIdRef.current) return;
      setError('Could not load project keys.');
    } finally {
      if (loadId === loadIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    void load(projectId);
  }, [projectId, load]);

  const handleCreated = (created: CreatedProjectKey): void => {
    setKeys((prev) =>
      [
        {
          id: created.id,
          projectId: created.projectId,
          name: created.name,
          createdAt: created.createdAt,
          revokedAt: null,
        },
        ...prev,
      ].sort(byNewest),
    );
  };

  const handleRevoked = (keyId: string): void => {
    const revokedAt = new Date().toISOString();
    setKeys((prev) => prev.map((k) => (k.id === keyId ? { ...k, revokedAt } : k)));
    setRevokeTarget(null);
  };

  const header = (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Project keys</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Publishable keys authenticate the events your apps and services send to this project.
        </p>
      </div>
      {!loading && !error && keys.length > 0 && (
        <PrimaryButton type="button" onClick={() => setCreateOpen(true)} className="shrink-0">
          <Plus className="size-3.5" />
          Create key
        </PrimaryButton>
      )}
    </header>
  );

  if (!activeProject) {
    return (
      <div className="max-w-2xl px-8 py-8">
        {header}
        <div className="rounded-md border border-border bg-metricyak-50 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Select a project from the switcher to manage its keys.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl px-8 py-8">
      {header}

      {loading ? (
        <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </ul>
      ) : error ? (
        <div className="rounded-md border border-border bg-metricyak-50 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => void load(activeProject.id)}
            className="mt-2 rounded-md px-3 py-1 text-sm font-medium text-metricyak-brand-orange transition-colors hover:bg-accent"
          >
            Try again
          </button>
        </div>
      ) : keys.length === 0 ? (
        <div className="flex flex-col items-center rounded-md border border-border bg-metricyak-50 px-6 py-12 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-metricyak-100 text-muted-foreground">
            <KeyRound className="size-5" />
          </span>
          <h2 className="mt-4 text-sm font-semibold text-foreground">No project keys yet</h2>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Create a publishable key to start sending events to MetricYak.
          </p>
          <PrimaryButton type="button" onClick={() => setCreateOpen(true)} className="mt-4">
            <Plus className="size-3.5" />
            Create key
          </PrimaryButton>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
          {keys.map((keyItem) => (
            <KeyRow key={keyItem.id} keyItem={keyItem} onRevoke={setRevokeTarget} />
          ))}
        </ul>
      )}

      <CreateKeyDialog
        open={createOpen}
        projectId={activeProject.id}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
      <RevokeKeyDialog
        target={revokeTarget}
        projectId={activeProject.id}
        onClose={() => setRevokeTarget(null)}
        onRevoked={handleRevoked}
      />
    </div>
  );
}
