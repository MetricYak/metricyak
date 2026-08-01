import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProjectRoute } from '@/hooks/useProjectRoute';
import { cn } from '@/lib/utils';
import { type NavItemData, navItemOwnsRoute } from './nav.config';

interface NavItemProps {
  item: NavItemData;
  collapsed?: boolean;
  onOpenSubMenu?: (id: string) => void;
  onHoverMenu?: (id: string) => void;
  onLeaveMenu?: () => void;
  menuOpen?: boolean;
}

function Highlight(): React.JSX.Element {
  return (
    <motion.span
      layoutId="nav-highlight"
      transition={{ type: 'spring', bounce: 0.4, visualDuration: 0.4 }}
      className="pointer-events-none absolute inset-0 rounded-md border border-metricyak-brand-orange bg-metricyak-brand-orange/15"
    />
  );
}

export function NavItem({
  item,
  collapsed = false,
  onOpenSubMenu,
  onHoverMenu,
  onLeaveMenu,
  menuOpen = false,
}: NavItemProps): React.JSX.Element {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { to } = useProjectRoute();
  const Icon = item.icon;
  const hasMenu = Boolean(item.menu);
  const hasSubItems = hasMenu;
  const resolvedPath = item.pathSuffix ? to(item.pathSuffix) : undefined;
  const isActive = navItemOwnsRoute(item, pathname);

  const handleClick = (): void => {
    if (hasMenu) {
      onOpenSubMenu?.(item.id);
    } else if (resolvedPath) {
      navigate(resolvedPath);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerEnter={hasMenu ? () => onHoverMenu?.(item.id) : undefined}
      onPointerLeave={hasMenu ? onLeaveMenu : undefined}
      onFocus={hasMenu ? () => onHoverMenu?.(item.id) : undefined}
      aria-expanded={hasMenu ? menuOpen : undefined}
      data-active={isActive}
      data-menu-open={menuOpen}
      className={cn(
        'group/navitem relative flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors',
        'data-[active=true]:font-medium',
        !isActive &&
          'hover:bg-sidebar-accent group-data-[collapsed=true]/panel:hover:bg-transparent',
        !isActive && menuOpen && 'bg-sidebar-accent',
        'group-data-[collapsed=true]/panel:flex-col group-data-[collapsed=true]/panel:gap-1 group-data-[collapsed=true]/panel:p-0',
      )}
    >
      {isActive && !collapsed && <Highlight />}

      <span
        className={cn(
          'relative z-10 flex shrink-0 items-center justify-center',
          'group-data-[collapsed=true]/panel:size-9 group-data-[collapsed=true]/panel:rounded-md',
          !isActive && 'group-data-[collapsed=true]/panel:group-hover/navitem:bg-sidebar-accent',
        )}
      >
        {isActive && collapsed && <Highlight />}
        <Icon
          className={cn(
            'relative z-10 size-5 shrink-0',
            item.iconColor ?? 'group-data-[active=true]/navitem:text-sidebar-accent-foreground',
          )}
        />
      </span>

      <span
        className={cn(
          'relative z-10 flex-1 truncate text-left',
          'group-data-[collapsed=true]/panel:w-full group-data-[collapsed=true]/panel:flex-none group-data-[collapsed=true]/panel:truncate group-data-[collapsed=true]/panel:text-center group-data-[collapsed=true]/panel:text-[10px] group-data-[collapsed=true]/panel:leading-tight',
        )}
      >
        {item.label}
      </span>

      {hasSubItems && (
        <ChevronRight className="relative z-10 size-4 shrink-0 text-muted-foreground group-data-[collapsed=true]/panel:hidden" />
      )}
    </button>
  );
}
