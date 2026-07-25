import { CopyButton } from '@/components/settings/CopyButton';
import { formatDate, formatLastUsed } from '@/components/settings/key/key-time';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';

interface KeyCardProps {
  keyValue: string;
  createdAt: string;
  lastUsedAt: string | null;
  now: Date;
  busy: boolean;
  onRoll: () => void;
  onRevoke: () => void;
}

export function KeyCard({
  keyValue,
  createdAt,
  lastUsedAt,
  now,
  busy,
  onRoll,
  onRevoke,
}: KeyCardProps): React.JSX.Element {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardContent className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
        <p className="mb-1.5 text-sm font-medium text-foreground">Current key</p>
        <div className="flex flex-wrap items-center gap-3">
          <code className="min-w-0 flex-1 break-all rounded-md border border-input bg-metricyak-50 px-3 py-2 font-mono text-[13px] text-foreground">
            {keyValue}
          </code>
          <CopyButton
            value={keyValue}
            label="Copy current key"
            className="shrink-0 rounded-md border border-input bg-background px-3 py-2"
          >
            Copy
          </CopyButton>
        </div>
        <p className="mt-2.5 text-xs text-muted-foreground">
          Created {formatDate(createdAt)} · {formatLastUsed(lastUsedAt, now)}
        </p>
      </CardContent>

      <CardFooter className="min-h-13 flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 sm:px-5">
        <Button variant="outline" size="sm" onClick={onRoll} disabled={busy}>
          Roll key
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRevoke}
          disabled={busy}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          Revoke
        </Button>
      </CardFooter>
    </Card>
  );
}
