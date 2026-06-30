import { cn } from '@/lib/utils';

interface SidePanelHeaderProps {
  className?: string;
}

export function SidePanelHeader({ className }: SidePanelHeaderProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-3',
        className,
      )}
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-foreground font-bold text-background text-sm">
        M
      </div>
    </div>
  );
}
