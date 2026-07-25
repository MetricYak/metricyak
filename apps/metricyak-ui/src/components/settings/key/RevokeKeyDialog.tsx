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
  hasGrace: boolean;
  now: Date;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const CONSEQUENCE =
  'Everything sending events with this key stops immediately. Events sent before you deploy a new key are rejected and cannot be recovered.';

const GRACE_CONSEQUENCE = `${CONSEQUENCE} The previous key is revoked at the same time.`;

export function RevokeKeyDialog({
  open,
  projectName,
  lastUsedAt,
  hasGrace,
  now,
  busy,
  onConfirm,
  onCancel,
}: RevokeKeyDialogProps): React.JSX.Element {
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    if (open) setConfirmation('');
  }, [open]);

  const expected = projectName.trim();
  const matches = expected.length > 0 && confirmation.trim() === expected;

  return (
    <SettingsDialog
      open={open}
      onClose={onCancel}
      title="Revoke the project key?"
      description={hasGrace ? GRACE_CONSEQUENCE : CONSEQUENCE}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
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
        <Label
          htmlFor="revoke-confirmation"
          className="block break-words text-sm font-medium text-foreground"
        >
          Type <span className="font-semibold">{expected}</span> to confirm
        </Label>
        <Input
          id="revoke-confirmation"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches && !busy) onConfirm();
          }}
          autoComplete="off"
          data-autofocus
          readOnly={busy}
          className="mt-1.5"
        />
      </div>
    </SettingsDialog>
  );
}
