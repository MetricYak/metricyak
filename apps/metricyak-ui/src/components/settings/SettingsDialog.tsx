import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  dismissable?: boolean;
}

export function SettingsDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  dismissable = true,
}: SettingsDialogProps): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = `dialog-title-${title.replace(/\s+/g, '-').toLowerCase()}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: onClick only detects backdrop clicks; keyboard dismissal is handled natively by the dialog's onCancel (Esc).
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={cn(
        'dialog w-[calc(100vw-2rem)] max-w-md p-0 backdrop:backdrop-blur-[2px]',
        className,
      )}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissable) onClose();
      }}
      onClick={(e) => {
        if (dismissable && e.target === ref.current) onClose();
      }}
    >
      <div className="flex max-h-[inherit] flex-col">
        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-foreground">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {dismissable && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="overflow-y-auto px-5 pb-1">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-4">{footer}</div>
        )}
      </div>
    </dialog>
  );
}
