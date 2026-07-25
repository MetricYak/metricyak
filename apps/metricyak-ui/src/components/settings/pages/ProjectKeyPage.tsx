import { KeyRound, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  type GraceProjectKey,
  generateProjectKey,
  getProjectKey,
  type ProjectKeyState,
  revokeGraceKey,
  revokeProjectKey,
  rollProjectKey,
} from '@/api/project-key';
import type { Project } from '@/api/projects';
import { GraceBanner } from '@/components/settings/key/GraceBanner';
import { KeyCard } from '@/components/settings/key/KeyCard';
import { QuickStart } from '@/components/settings/key/QuickStart';
import { RevokeKeyDialog } from '@/components/settings/key/RevokeKeyDialog';
import { RollKeyDialog } from '@/components/settings/key/RollKeyDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useProjectContext } from '@/contexts/ProjectContext';
import { ApiError } from '@/lib/api';

const CLOCK_TICK_MS = 60_000;

type OpenDialog = 'none' | 'roll' | 'revoke' | 'revoke-grace';

function PageHeader(): React.JSX.Element {
  return (
    <header>
      <h1 className="text-xl font-semibold text-foreground">Project key</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Used by your SDKs to send events to this project. Safe to include in client code.
      </p>
    </header>
  );
}

function useTickingClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const handle = window.setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => window.clearInterval(handle);
  }, []);

  return now;
}

function useIsShowing(): React.RefObject<boolean> {
  const showing = useRef(true);

  useEffect(() => {
    showing.current = true;
    return () => {
      showing.current = false;
    };
  }, []);

  return showing;
}

function unexpiredGrace(state: ProjectKeyState | null, now: Date): GraceProjectKey | null {
  const grace = state?.grace ?? null;
  if (!grace) return null;
  return new Date(grace.expiresAt) > now ? grace : null;
}

function describeFailure(error: unknown): string | undefined {
  return error instanceof ApiError ? error.message : undefined;
}

function KeyPageSkeleton(): React.JSX.Element {
  return (
    <div className="mt-6 space-y-6" role="status" aria-busy="true" aria-label="Loading project key">
      <div
        aria-hidden="true"
        className="h-30 animate-pulse rounded-lg border border-border bg-metricyak-50"
      />
      <div
        aria-hidden="true"
        className="h-36 animate-pulse rounded-lg border border-border bg-metricyak-50"
      />
    </div>
  );
}

function ProjectKeyPanel({ project }: { project: Project }): React.JSX.Element {
  const now = useTickingClock();
  const showing = useIsShowing();

  const [state, setState] = useState<ProjectKeyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<OpenDialog>('none');

  const resyncKey = useCallback(async (): Promise<void> => {
    try {
      setState(await getProjectKey(project.id));
      setErrored(false);
    } catch {
      setErrored(true);
    }
  }, [project.id]);

  const loadKey = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      await resyncKey();
    } finally {
      setLoading(false);
    }
  }, [resyncKey]);

  useEffect(() => {
    void loadKey();
  }, [loadKey]);

  const runAction = async (
    action: (projectId: string) => Promise<ProjectKeyState>,
    successMessage: string,
    failureMessage: string,
  ): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await action(project.id);
      if (!showing.current) return;
      setDialog('none');
      setState(next);
      toast.success(successMessage);
    } catch (error) {
      if (!showing.current) return;
      setDialog('none');
      toast.error(failureMessage, { description: describeFailure(error) });
      await resyncKey();
    } finally {
      setBusy(false);
    }
  };

  const settled = !loading && !errored;
  const activeKey = settled ? (state?.active ?? null) : null;
  const graceKey = settled ? unexpiredGrace(state, now) : null;
  const hasNoKey = settled && state !== null && state.active === null;
  const ingestUrl = `${window.location.origin}/v1/ingest`;

  return (
    <div className="w-full max-w-2xl px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader />

      {loading && <KeyPageSkeleton />}

      {!loading && errored && (
        <Card className="mt-6 flex flex-col items-start gap-3 px-5 py-6">
          <p className="text-sm text-foreground">Could not load the project key.</p>
          <Button variant="outline" size="sm" onClick={() => void loadKey()}>
            Try again
          </Button>
        </Card>
      )}

      <div role="status" className="sr-only">
        {graceKey ? 'The previous project key still works during a grace period.' : ''}
      </div>

      {graceKey && (
        <div className="mt-6">
          <GraceBanner
            keyValue={graceKey.key}
            expiresAt={graceKey.expiresAt}
            now={now}
            busy={busy}
            onRevokeNow={() => setDialog('revoke-grace')}
          />
        </div>
      )}

      {activeKey && (
        <div className="mt-6">
          <KeyCard
            keyValue={activeKey.key}
            createdAt={activeKey.createdAt}
            lastUsedAt={activeKey.lastUsedAt}
            now={now}
            busy={busy}
            onRoll={() => setDialog('roll')}
            onRevoke={() => setDialog('revoke')}
          />
        </div>
      )}

      {activeKey && (
        <div className="mt-6">
          <QuickStart keyValue={activeKey.key} ingestUrl={ingestUrl} />
        </div>
      )}

      {hasNoKey && (
        <div className="mt-6 flex flex-col items-center rounded-lg border border-border bg-metricyak-50 px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-metricyak-100">
            <KeyRound className="size-5 text-muted-foreground" />
          </span>
          <h2 className="mt-4 text-sm font-semibold text-foreground">No project key</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Events sent to this project are rejected until you generate one. Generating a key takes
            a moment and you can roll or revoke it whenever you like.
          </p>
          <Button
            variant="raised"
            size="sm"
            className="mt-4"
            disabled={busy}
            onClick={() =>
              void runAction(
                generateProjectKey,
                'Project key generated',
                'Could not generate a key',
              )
            }
          >
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {busy ? 'Generating…' : 'Generate key'}
          </Button>
        </div>
      )}

      <RollKeyDialog
        open={dialog === 'roll'}
        lastUsedAt={activeKey?.lastUsedAt ?? null}
        hasGrace={graceKey !== null}
        now={now}
        busy={busy}
        onCancel={() => setDialog('none')}
        onConfirm={() =>
          void runAction(rollProjectKey, 'Project key rolled', 'Could not roll the key')
        }
      />

      <RevokeKeyDialog
        open={dialog === 'revoke'}
        projectName={project.name}
        lastUsedAt={activeKey?.lastUsedAt ?? null}
        hasGrace={graceKey !== null}
        now={now}
        busy={busy}
        onCancel={() => setDialog('none')}
        onConfirm={() =>
          void runAction(revokeProjectKey, 'Project key revoked', 'Could not revoke the key')
        }
      />

      <ConfirmDialog
        open={dialog === 'revoke-grace'}
        title="Revoke the previous key now?"
        description="Anything still using the previous key stops immediately. Your current key is unaffected."
        confirmLabel="Revoke now"
        busyLabel="Revoking…"
        destructive
        busy={busy}
        onCancel={() => setDialog('none')}
        onConfirm={() =>
          void runAction(
            revokeGraceKey,
            'Previous key revoked',
            'Could not revoke the previous key',
          )
        }
      />
    </div>
  );
}

export function ProjectKeyPage(): React.JSX.Element {
  const { activeProject } = useProjectContext();

  if (!activeProject) {
    return (
      <div className="w-full max-w-2xl px-4 py-6 sm:px-8 sm:py-8">
        <PageHeader />
        <Card className="mt-6 px-5 py-8">
          <p className="text-sm text-muted-foreground">
            Select a project from the switcher to see its key.
          </p>
        </Card>
      </div>
    );
  }

  return <ProjectKeyPanel key={activeProject.id} project={activeProject} />;
}
