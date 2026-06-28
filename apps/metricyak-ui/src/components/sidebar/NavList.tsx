import { LayoutGroup } from 'motion/react';
import { NavItem } from './NavItem';
import { navItems } from './nav.config';

interface NavListProps {
  activeId?: string;
  collapsed?: boolean;
  onOpenSubMenu?: (id: string) => void;
}

export function NavList({
  activeId,
  collapsed = false,
  onOpenSubMenu,
}: NavListProps): React.JSX.Element {
  return (
    <LayoutGroup id="nav-highlight">
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            active={item.id === activeId}
            collapsed={collapsed}
            onOpenSubMenu={onOpenSubMenu}
          />
        ))}
      </nav>
    </LayoutGroup>
  );
}
