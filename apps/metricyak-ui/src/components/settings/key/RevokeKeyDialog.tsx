import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatLastUsed } from '@/components/settings/key/key-time';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface RevokeKeyDialogProps {
  open: boolean;
  projectName: string;
  lastUsedAt: string | null;
  now: Date;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RevokeKeyDialog({
  open,
  projectName,
  lastUsedAt,
  now,
  busy,
  onConfirm,
  onCancel,
}: RevokeKeyDialogProps): React.JSX.Element {
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    if (open) setConfirmation('');
  }, [open]);

  const matches = confirmation.trim() === projectName.trim();

  return (
    <SettingsDialog
      open={open}
      onClose={onCancel}
      title="Revoke the project key?"
      description="Everything sending events with this key stops immediately. Events sent before you deploy a new key are rejected and cannot be recovered."
      dismissable={!busy}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={!matches || busy}
          >
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {busy ? 'Revoking…' : 'Revoke key'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">{formatLastUsed(lastUsedAt, now)}.</p>

      <div className="mt-4">
        <Label htmlFor="revoke-confirmation" className="text-sm font-medium text-foreground">
          Type <span className="font-semibold">{projectName}</span> to confirm
        </Label>
        <Input
          id="revoke-confirmation"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches && !busy) onConfirm();
          }}
          autoComplete="off"
          autoFocus
          disabled={busy}
          className="mt-1.5"
        />
      </div>
    </SettingsDialog>
  );
}
