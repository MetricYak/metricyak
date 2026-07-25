import { KeyRound, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
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
import { RevokeGraceDialog } from '@/components/settings/key/RevokeGraceDialog';
import { RevokeKeyDialog } from '@/components/settings/key/RevokeKeyDialog';
import { RollKeyDialog } from '@/components/settings/key/RollKeyDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useProjectContext } from '@/contexts/ProjectContext';

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

function ProjectKeyPanel({ project }: { project: Project }): React.JSX.Element {
  const now = useTickingClock();

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
    onSuccess: () => void,
    failureMessage: string,
  ): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      setState(await action(project.id));
      setDialog('none');
      onSuccess();
    } catch {
      toast.error(failureMessage);
      await resyncKey();
    } finally {
      setBusy(false);
    }
  };

  const settled = !loading && !errored;
  const activeKey = settled ? (state?.active ?? null) : null;
  const graceKey = settled ? (state?.grace ?? null) : null;
  const hasNoKey = settled && state !== null && state.active === null;
  const ingestUrl = `${window.location.origin}/v1/ingest`;

  return (
    <div className="w-full max-w-2xl px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader />

      {loading && (
        <div className="mt-6 h-32 animate-pulse rounded-lg border border-border bg-metricyak-50" />
      )}

      {!loading && errored && (
        <Card className="mt-6 flex flex-col items-start gap-3 px-5 py-6">
          <p className="text-sm text-foreground">Could not load the project key.</p>
          <Button variant="outline" size="sm" onClick={() => void loadKey()}>
            Try again
          </Button>
        </Card>
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
            Events sent to this project are rejected until you generate one.
          </p>
          <Button
            variant="raised"
            size="sm"
            className="mt-4"
            disabled={busy}
            onClick={() =>
              void runAction(
                generateProjectKey,
                () => toast.success('Project key generated'),
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
        now={now}
        busy={busy}
        onCancel={() => setDialog('none')}
        onConfirm={() =>
          void runAction(
            rollProjectKey,
            () =>
              toast.success('Project key rolled', {
                description: 'The previous key keeps working for 24 hours.',
              }),
            'Could not roll the key',
          )
        }
      />

      <RevokeKeyDialog
        open={dialog === 'revoke'}
        projectName={project.name}
        lastUsedAt={activeKey?.lastUsedAt ?? null}
        now={now}
        busy={busy}
        onCancel={() => setDialog('none')}
        onConfirm={() =>
          void runAction(
            revokeProjectKey,
            () => toast.success('Project key revoked'),
            'Could not revoke the key',
          )
        }
      />

      <RevokeGraceDialog
        open={dialog === 'revoke-grace'}
        busy={busy}
        onCancel={() => setDialog('none')}
        onConfirm={() =>
          void runAction(
            revokeGraceKey,
            () => toast.success('Previous key revoked'),
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
