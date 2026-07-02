import { Check, Loader2 } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { updateProject } from '@/api/projects';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProjectContext } from '@/contexts/ProjectContext';
import { CopyButton } from '../CopyButton';

const NAME_MAX = 128;

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    date,
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[9rem_1fr] sm:items-center sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function ProjectGeneralPage(): React.JSX.Element {
  const { activeOrg, activeProject, updateActiveProject } = useProjectContext();
  const reduceMotion = useReducedMotion();

  const [name, setName] = useState(activeProject?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef<number | null>(null);

  useEffect(() => {
    setName(activeProject?.name ?? '');
    setError(null);
  }, [activeProject]);

  useEffect(
    () => () => {
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
    },
    [],
  );

  if (!activeProject || !activeOrg) {
    return (
      <div className="w-full max-w-2xl px-4 py-6 sm:px-8 sm:py-8">
        <PageHeader />
        <Card className="px-5 py-8">
          <p className="text-sm text-muted-foreground">
            Select a project from the switcher to manage its settings.
          </p>
        </Card>
      </div>
    );
  }

  const trimmed = name.trim();
  const dirty = trimmed.length > 0 && trimmed !== activeProject.name;

  const handleSave = async (): Promise<void> => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProject(activeOrg.id, activeProject.id, { name: trimmed });
      updateActiveProject(updated);
      setName(updated.name);
      setJustSaved(true);
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setJustSaved(false), 2400);
    } catch {
      setError('Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = (): void => {
    setName(activeProject.name);
    setError(null);
  };

  return (
    <div className="w-full max-w-2xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader />

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="px-4 pb-0 pt-4 sm:px-5 sm:pt-5">
          <Label htmlFor="display-name" className="text-sm font-semibold text-foreground">
            Display name
          </Label>
          <CardDescription>Shown across MetricYak wherever this project appears.</CardDescription>
        </CardHeader>

        <CardContent className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
          <Input
            id="display-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSave();
            }}
            maxLength={NAME_MAX}
            autoComplete="off"
            disabled={saving}
            aria-invalid={error != null}
          />
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent>

        <CardFooter className="min-h-13 flex-wrap justify-between gap-x-3 gap-y-2 border-t bg-metricyak-50 px-4 py-2.5 sm:px-5">
          <div className="min-w-0 text-xs">
            <AnimatePresence initial={false} mode="wait">
              {justSaved ? (
                <motion.span
                  key="saved"
                  initial={reduceMotion ? false : { opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="flex items-center gap-1.5 font-medium text-foreground"
                >
                  <Check className="size-3.5 text-metricyak-brand-orange" />
                  Saved
                </motion.span>
              ) : (
                <motion.span
                  key="hint"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="block truncate text-muted-foreground"
                >
                  Up to {NAME_MAX} characters.
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <AnimatePresence initial={false}>
              {dirty && (
                <motion.div
                  key="discard"
                  initial={reduceMotion ? false : { opacity: 0, x: 4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 4 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                >
                  <Button variant="ghost" size="sm" onClick={handleDiscard} disabled={saving}>
                    Discard
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            <Button
              variant="raised"
              size="sm"
              onClick={() => void handleSave()}
              disabled={!dirty || saving}
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </CardFooter>
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="px-4 pb-0 pt-4 sm:px-5 sm:pt-5">
          <CardTitle className="text-sm font-semibold text-foreground">Details</CardTitle>
          <CardDescription>Identifiers and metadata for this project.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-3 sm:px-5">
          <dl className="divide-y divide-border">
            <DetailRow label="Project ID">
              <div className="flex items-center gap-2">
                <code className="min-w-0 break-all font-mono text-[13px] text-foreground">
                  {activeProject.id}
                </code>
                <CopyButton
                  value={activeProject.id}
                  label="Copy project ID"
                  className="shrink-0 p-1"
                />
              </div>
            </DetailRow>
            <DetailRow label="Organization">{activeOrg.name}</DetailRow>
            <DetailRow label="Created">{formatDate(activeProject.createdAt)}</DetailRow>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function PageHeader(): React.JSX.Element {
  return (
    <header>
      <h1 className="text-xl font-semibold text-foreground">General</h1>
      <p className="mt-1 text-sm text-muted-foreground">High-level settings for this project.</p>
    </header>
  );
}
