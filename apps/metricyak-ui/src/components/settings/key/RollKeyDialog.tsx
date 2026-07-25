import { Loader2 } from 'lucide-react';
import { formatLastUsed } from '@/components/settings/key/key-time';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { Button } from '@/components/ui/button';

interface RollKeyDialogProps {
  open: boolean;
  lastUsedAt: string | null;
  now: Date;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RollKeyDialog({
  open,
  lastUsedAt,
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
      description="A new key takes effect immediately. The current key keeps working for 24 hours, then stops."
      dismissable={!busy}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
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
