import { X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Resizable } from '@/components/resizable/Resizable';
import { cn } from '@/lib/utils';
import type { NavItemData } from './nav.config';

interface SubMenuPanelProps {
  item: NavItemData;
  onClose: () => void;
}

export function SubMenuPanel({ item, onClose }: SubMenuPanelProps): React.JSX.Element {
  return (
    <Resizable
      side="right"
      collapsible={false}
      minWidth={180}
      maxWidth={360}
      defaultWidth={224}
      storageKey="metricyak.submenupanel"
      className="border-sidebar-border border-r bg-sidebar-bg text-sidebar-foreground"
    >
      <div className="flex h-full flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-sidebar-border border-b px-4">
          <span className="truncate font-semibold text-sm">{item.label}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sub-menu"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {item.items?.map((subItem) => (
            <NavLink
              key={subItem.id}
              to={subItem.path}
              end
              className={({ isActive }) =>
                cn(
                  'truncate rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent',
                  isActive && 'bg-sidebar-accent font-medium',
                )
              }
            >
              {subItem.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </Resizable>
  );
}
