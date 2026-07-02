import { ChevronDown, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface SettingsItem {
  id: string;
  label: string;
  path: string;
}

interface SettingsSection {
  id: string;
  label: string;
  items: SettingsItem[];
}

const sections: readonly SettingsSection[] = [
  {
    id: 'project',
    label: 'Project',
    items: [
      { id: 'project-general', label: 'General', path: '/settings/project/general' },
      { id: 'project-keys', label: 'Project keys', path: '/settings/project/keys' },
    ],
  },
] satisfies readonly SettingsSection[];

function SettingsNavItem({ item }: { item: SettingsItem }): React.JSX.Element {
  return (
    <NavLink
      to={item.path}
      end
      className={({ isActive }) =>
        cn(
          'relative flex items-center rounded-md px-3 py-1.5 text-sm transition-colors',
          !isActive && 'text-foreground/75 hover:bg-accent hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="settings-nav-highlight"
              transition={{ type: 'spring', bounce: 0.3, visualDuration: 0.35 }}
              className="pointer-events-none absolute inset-0 rounded-md border border-metricyak-brand-orange/40 bg-metricyak-brand-orange/10"
            />
          )}
          <span className={cn('relative z-10', isActive && 'font-medium text-foreground')}>
            {item.label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function SettingsNav(): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [openSections, setOpenSections] = useState<ReadonlySet<string>>(
    () => new Set(sections.map((s) => s.id)),
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const isSearching = query.trim().length > 0;

  const toggle = (id: string): void => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleSections = useMemo(() => {
    if (!isSearching) return sections;
    const q = query.trim().toLowerCase();
    return sections
      .map((s) => ({
        ...s,
        items: s.items.filter((item) => item.label.toLowerCase().includes(q)),
      }))
      .filter((s) => s.items.length > 0);
  }, [query, isSearching]);

  return (
    <nav
      aria-label="Settings navigation"
      className="flex w-60 shrink-0 flex-col overflow-hidden border-r border-border bg-background"
    >
      {/* Panel title */}
      <div className="px-4 pb-2 pt-5">
        <h2 className="text-base font-semibold text-foreground">Settings</h2>
      </div>

      {/* Search */}
      <div className="px-3 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setQuery('');
                inputRef.current?.blur();
              }
            }}
            placeholder="Search settings…"
            aria-label="Search settings"
            className={cn(
              'h-8 w-full rounded-md border border-input bg-muted pl-8 text-sm',
              'text-foreground placeholder:text-muted-foreground',
              'transition-colors focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring',
              query && 'pr-7',
            )}
          />
          <AnimatePresence>
            {query && (
              <motion.button
                initial={{ opacity: 0, scale: 0.75 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.75 }}
                transition={{ duration: 0.1, ease: 'easeOut' }}
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-2 pb-4">
        <AnimatePresence mode="wait" initial={false}>
          {isSearching ? (
            <motion.div
              key="search"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              {visibleSections.length > 0 ? (
                visibleSections.map((section) => (
                  <div key={section.id} className="mb-1">
                    <p className="mb-0.5 px-2 pt-2 text-xs font-bold text-muted-foreground">
                      {section.label}
                    </p>
                    <div className="flex flex-col gap-0.5">
                      {section.items.map((item, i) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: -3 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.15, delay: i * 0.03, ease: 'easeOut' }}
                        >
                          <SettingsNavItem item={item} />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                  No results for <span className="font-medium text-foreground">"{query}"</span>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="accordion"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="flex flex-col gap-0.5"
            >
              {sections.map((section) => {
                const isOpen = openSections.has(section.id);
                return (
                  <div key={section.id}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`settings-section-${section.id}`}
                      onClick={() => toggle(section.id)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {section.label}
                      <motion.span
                        animate={{ rotate: isOpen ? 0 : -90 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="shrink-0"
                      >
                        <ChevronDown className="size-3.5" />
                      </motion.span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          id={`settings-section-${section.id}`}
                          key="content"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col gap-0.5 pb-1 pl-2 pt-0.5">
                            {section.items.map((item) => (
                              <SettingsNavItem key={item.id} item={item} />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
