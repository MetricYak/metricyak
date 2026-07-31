import { LayoutGroup } from 'motion/react';
import { NavItem } from './NavItem';
import { navItems } from './nav.config';

interface NavListProps {
  openMenuId?: string;
  collapsed?: boolean;
  onOpenSubMenu?: (id: string) => void;
  onHoverMenu?: (id: string) => void;
  onLeaveMenu?: () => void;
}

export function NavList({
  openMenuId,
  collapsed = false,
  onOpenSubMenu,
  onHoverMenu,
  onLeaveMenu,
}: NavListProps): React.JSX.Element {
  return (
    <LayoutGroup id="nav-highlight">
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            menuOpen={item.id === openMenuId}
            collapsed={collapsed}
            onOpenSubMenu={onOpenSubMenu}
            onHoverMenu={onHoverMenu}
            onLeaveMenu={onLeaveMenu}
          />
        ))}
      </nav>
    </LayoutGroup>
  );
}
