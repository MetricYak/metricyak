import { PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import { useId, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { useProjectRoute } from '@/hooks/useProjectRoute';
import { cn } from '@/lib/utils';
import { type FlyoutMenuData, filterMenuGroups } from './flyout-menu';

interface FlyoutMenuPanelProps {
  menu: FlyoutMenuData;
  pinned?: boolean;
  onTogglePin?: () => void;
  onNavigate?: () => void;
}

export function FlyoutMenuPanel({
  menu,
  pinned = false,
  onTogglePin,
  onNavigate,
}: FlyoutMenuPanelProps): React.JSX.Element {
  const { to } = useProjectRoute();
  const [query, setQuery] = useState('');
  const searchId = useId();
  const groups = filterMenuGroups(menu.groups, query);
  const PinIcon = pinned ? PanelLeftClose : PanelLeftOpen;

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <div className="flex shrink-0 items-center gap-2 py-3 pr-2 pl-4">
        <h2 className="min-w-0 flex-1 truncate font-semibold text-sm">{menu.title}</h2>
        {onTogglePin ? (
          <button
            type="button"
            onClick={onTogglePin}
            aria-pressed={pinned}
            title={
              pinned ? 'Let this menu slide away again' : 'Keep this menu open beside the sidebar'
            }
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            <PinIcon className="size-3.5" aria-hidden="true" />
            {pinned ? 'Unpin' : 'Pin'}
          </button>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-border border-b px-4 pb-2.5">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <Input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={menu.searchPlaceholder}
          aria-label={menu.searchPlaceholder}
          className="h-8 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 pt-3 pb-6">
        {groups.map((group) => (
          <div key={group.id} className="mb-4 last:mb-0">
            <h3 className="px-2.5 pb-2 font-semibold text-muted-foreground text-xs">
              {group.label}
            </h3>
            <div className="flex flex-col gap-px">
              {group.items.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <NavLink
                    key={item.id}
                    to={to(item.pathSuffix)}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm transition-colors',
                        'hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2',
                        isActive && 'bg-accent font-medium',
                      )
                    }
                  >
                    {ItemIcon ? (
                      <ItemIcon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.needsAttention ? (
                      <span
                        role="img"
                        aria-label="Needs attention"
                        className="size-1.5 shrink-0 rounded-full bg-destructive"
                      />
                    ) : null}
                    {item.meta ? (
                      <span className="shrink-0 text-muted-foreground text-xs">{item.meta}</span>
                    ) : null}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}

        {groups.length === 0 ? (
          <p className="px-3 py-6 text-center text-muted-foreground text-sm">{menu.emptyText}</p>
        ) : null}
      </nav>
    </div>
  );
}
