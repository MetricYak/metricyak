import { Resizable } from '@/components/resizable/Resizable';
import { NavList } from './NavList';
import { SidePanelBody } from './SidePanelBody';
import { SidePanelFooter } from './SidePanelFooter';
import { SidePanelHeader } from './SidePanelHeader';

interface SidePanelProps {
  activeSubMenuId?: string;
  onOpenSubMenu: (id: string) => void;
}

export function SidePanel({ activeSubMenuId, onOpenSubMenu }: SidePanelProps): React.JSX.Element {
  return (
    <Resizable
      side="right"
      minWidth={200}
      maxWidth={420}
      defaultWidth={256}
      collapseThreshold={150}
      collapsedWidth={64}
      storageKey="metricyak.sidepanel"
      className="border-sidebar-border border-r bg-sidebar-bg text-sidebar-foreground"
    >
      {({ collapsed, setCollapsed }) => (
        <div className="flex h-full flex-col">
          <SidePanelHeader />
          <SidePanelBody>
            <NavList
              activeId={activeSubMenuId}
              collapsed={collapsed}
              onOpenSubMenu={onOpenSubMenu}
            />
          </SidePanelBody>
          <SidePanelFooter
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed(!collapsed)}
          />
        </div>
      )}
    </Resizable>
  );
}
