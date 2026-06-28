import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { NavItemData } from './nav.config';

interface NavItemProps {
  item: NavItemData;
  active?: boolean;
  collapsed?: boolean;
  onOpenSubMenu?: (id: string) => void;
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
  active = false,
  collapsed = false,
  onOpenSubMenu,
}: NavItemProps): React.JSX.Element {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const Icon = item.icon;
  const hasSubItems = Boolean(item.items?.length);
  const isActive =
    active ||
    (Boolean(item.path) && (pathname === item.path || pathname.startsWith(`${item.path}/`)));

  const handleClick = (): void => {
    if (hasSubItems) {
      onOpenSubMenu?.(item.id);
    } else if (item.path) {
      navigate(item.path);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      data-active={isActive}
      className={cn(
        'group/navitem relative flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors',
        'data-[active=true]:font-medium',
        !isActive &&
          'hover:bg-sidebar-accent group-data-[collapsed=true]/panel:hover:bg-transparent',
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
        <Icon className="relative z-10 size-5 shrink-0 group-data-[active=true]/navitem:text-sidebar-accent-foreground" />
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
