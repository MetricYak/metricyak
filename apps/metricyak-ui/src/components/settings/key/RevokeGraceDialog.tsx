import { Loader2 } from 'lucide-react';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { Button } from '@/components/ui/button';

interface RevokeGraceDialogProps {
  open: boolean;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RevokeGraceDialog({
  open,
  busy,
  onConfirm,
  onCancel,
}: RevokeGraceDialogProps): React.JSX.Element {
  return (
    <SettingsDialog
      open={open}
      onClose={onCancel}
      title="Revoke the previous key now?"
      description="Anything still using the previous key stops immediately. Your current key is unaffected."
      dismissable={!busy}
      className="max-w-sm"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {busy ? 'Revoking…' : 'Revoke now'}
          </Button>
        </>
      }
    >
      {null}
    </SettingsDialog>
  );
}
