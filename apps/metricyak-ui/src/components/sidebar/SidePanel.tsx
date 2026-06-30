import { Resizable } from '@/components/resizable/Resizable';
import { NavItem } from './NavItem';
import { NavList } from './NavList';
import { bottomNavItems } from './nav.config';
import { SidePanelBody } from './SidePanelBody';
import { SidePanelFooter } from './SidePanelFooter';

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
          <SidePanelBody>
            <NavList
              activeId={activeSubMenuId}
              collapsed={collapsed}
              onOpenSubMenu={onOpenSubMenu}
            />
          </SidePanelBody>
          <div className="shrink-0 px-2 pb-1">
            {bottomNavItems.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                collapsed={collapsed}
                onOpenSubMenu={onOpenSubMenu}
              />
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
