import { Search } from 'lucide-react';
import { useId, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { useProjectRoute } from '@/hooks/useProjectRoute';
import { cn } from '@/lib/utils';
import { type FlyoutMenuData, type FlyoutMenuItem, filterMenuGroups } from './flyout-menu';

const ROW = 'flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm';

interface FlyoutMenuPanelProps {
  title: string;
  menu: FlyoutMenuData;
  onNavigate?: () => void;
}

function ItemContent({ item }: { item: FlyoutMenuItem }): React.JSX.Element {
  const ItemIcon = item.icon;
  return (
    <>
      {ItemIcon ? <ItemIcon className="size-4 shrink-0" aria-hidden="true" /> : null}
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
    </>
  );
}

export function FlyoutMenuPanel({
  title,
  menu,
  onNavigate,
}: FlyoutMenuPanelProps): React.JSX.Element {
  const { to } = useProjectRoute();
  const [query, setQuery] = useState('');
  const searchId = useId();
  const groups = filterMenuGroups(menu.groups, query);

  return (
    <div className="flex h-full flex-col bg-sidebar-panel text-sidebar-foreground">
      <div className="flex shrink-0 items-center py-3 pr-2 pl-4">
        <h2 className="min-w-0 flex-1 truncate font-semibold text-sm">{title}</h2>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-sidebar-border border-b px-4 pb-2.5">
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
              {group.items.map((item) =>
                item.kind === 'link' ? (
                  <NavLink
                    key={item.id}
                    to={to(item.pathSuffix)}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        ROW,
                        'transition-colors hover:bg-sidebar-bg',
                        'focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2',
                        isActive && 'bg-sidebar-accent font-medium',
                      )
                    }
                  >
                    <ItemContent item={item} />
                  </NavLink>
                ) : (
                  <div
                    key={item.id}
                    aria-disabled="true"
                    title={`${item.label} — coming soon`}
                    className={cn(ROW, 'text-muted-foreground/70')}
                  >
                    <ItemContent item={item} />
                    <span className="sr-only">Coming soon</span>
                  </div>
                ),
              )}
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
