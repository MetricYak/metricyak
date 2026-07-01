import { cn } from '@/lib/utils';
import { ProjectSwitcher } from './ProjectSwitcher';

interface SidePanelHeaderProps {
  collapsed: boolean;
  className?: string;
}

export function SidePanelHeader({ collapsed, className }: SidePanelHeaderProps): React.JSX.Element {
  return (
    <div className={cn('shrink-0 border-b border-sidebar-border p-2', className)}>
      <ProjectSwitcher collapsed={collapsed} />
    </div>
  );
}
