import { TriangleAlert } from 'lucide-react';
import { CopyButton } from '@/components/settings/CopyButton';
import { formatCountdown } from '@/components/settings/key/key-time';
import { Button } from '@/components/ui/button';

interface GraceBannerProps {
  keyValue: string;
  expiresAt: string;
  now: Date;
  busy: boolean;
  onRevokeNow: () => void;
}

export function GraceBanner({
  keyValue,
  expiresAt,
  now,
  busy,
  onRevokeNow,
}: GraceBannerProps): React.JSX.Element {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3.5 sm:px-5">
      <div className="flex items-start gap-2.5">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            Previous key still works for {formatCountdown(expiresAt, now)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Update your clients before it stops, or revoke it now if nothing is using it.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code className="min-w-0 flex-1 break-all rounded-md border border-input bg-background px-3 py-2 font-mono text-[13px] text-muted-foreground">
              {keyValue}
            </code>
            <CopyButton
              value={keyValue}
              label="Copy previous key"
              className="shrink-0 rounded-md border border-input bg-background px-3 py-2"
            >
              Copy
            </CopyButton>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRevokeNow}
              disabled={busy}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Revoke now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
