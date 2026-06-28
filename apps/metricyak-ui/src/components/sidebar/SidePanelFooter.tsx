import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidePanelFooterProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
}

export function SidePanelFooter({
  collapsed,
  onToggleCollapse,
  className,
}: SidePanelFooterProps): React.JSX.Element {
  return (
    <div className={cn('shrink-0 border-t border-sidebar-border p-2', className)}>
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-muted-foreground text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
      >
        {collapsed ? (
          <PanelLeftOpen className="size-5 shrink-0" />
        ) : (
          <PanelLeftClose className="size-5 shrink-0" />
        )}
        <span className="truncate group-data-[collapsed=true]/panel:hidden">Collapse</span>
      </button>
    </div>
  );
}
