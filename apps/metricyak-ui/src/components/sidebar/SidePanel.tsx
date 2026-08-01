import { Resizable } from '@/components/resizable/Resizable';
import { NavItem } from './NavItem';
import { NavList } from './NavList';
import { bottomNavItems } from './nav.config';
import { SidebarCollapseShortcut } from './SidebarCollapseShortcut';
import { SidePanelBody } from './SidePanelBody';
import { SidePanelFooter } from './SidePanelFooter';
import { SidePanelHeader } from './SidePanelHeader';

interface SidePanelProps {
  openMenuId?: string;
  onHoverMenu?: (id: string) => void;
  onLeaveMenu?: () => void;
}

export function SidePanel({
  openMenuId,
  onHoverMenu,
  onLeaveMenu,
}: SidePanelProps): React.JSX.Element {
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
          <SidebarCollapseShortcut collapsed={collapsed} setCollapsed={setCollapsed} />
          <SidePanelHeader collapsed={collapsed} />
          <SidePanelBody>
            <NavList
              openMenuId={openMenuId}
              collapsed={collapsed}
              onHoverMenu={onHoverMenu}
              onLeaveMenu={onLeaveMenu}
            />
          </SidePanelBody>
          <div className="shrink-0 px-2 pb-1">
            {bottomNavItems.map((item) => (
              <NavItem key={item.id} item={item} collapsed={collapsed} />
            ))}
          </div>
          <SidePanelFooter
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed(!collapsed)}
          />
        </div>
      )}
    </Resizable>
  );
}
