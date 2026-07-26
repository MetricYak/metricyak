import { Loader2 } from 'lucide-react';
import { formatLastUsed } from '@/components/settings/key/key-time';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { Button } from '@/components/ui/button';

interface RollKeyDialogProps {
  open: boolean;
  lastUsedAt: string | null;
  hasGrace: boolean;
  now: Date;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const EFFECT =
  'A new key takes effect immediately. The current key keeps working for 24 hours, then stops.';

const GRACE_EFFECT = `${EFFECT} The key already in its grace period is revoked now.`;

export function RollKeyDialog({
  open,
  lastUsedAt,
  hasGrace,
  now,
  busy,
  onConfirm,
  onCancel,
}: RollKeyDialogProps): React.JSX.Element {
  return (
    <SettingsDialog
      open={open}
      onClose={onCancel}
      title="Roll the project key?"
      description={hasGrace ? GRACE_EFFECT : EFFECT}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel} data-autofocus>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {busy ? 'Rolling…' : 'Roll key'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">{formatLastUsed(lastUsedAt, now)}.</p>
    </SettingsDialog>
  );
}
