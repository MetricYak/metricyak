import { Loader2 } from 'lucide-react';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  busyLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  busyLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <SettingsDialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      className="max-w-sm"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel} data-autofocus>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
          </Button>
        </>
      }
    >
      {null}
    </SettingsDialog>
  );
}
