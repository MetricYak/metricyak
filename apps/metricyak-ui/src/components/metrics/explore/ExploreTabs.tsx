import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { EXPLORE_TABS, type ExploreTab } from './explore-url';

const TAB_LABEL: Readonly<Record<ExploreTab, string>> = {
  breakdown: 'Property breakdown',
  events: 'Events',
};

const TAB_HINT: Readonly<Record<ExploreTab, string>> = {
  breakdown: 'Which segments moved the number',
  events: 'The raw events behind the selection',
};

const PANEL_ID = 'explore-tab-panel';

function tabId(tab: ExploreTab): string {
  return `explore-tab-${tab}`;
}

interface ExploreTabsProps {
  tab: ExploreTab;
  onChange: (next: ExploreTab) => void;
  children: ReactNode;
}

export function ExploreTabs({ tab, onChange, children }: ExploreTabsProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-border border-b px-4 sm:px-5">
        <LayoutGroup id="explore-tabs">
          <div role="tablist" aria-label="Explain the change" className="flex items-stretch gap-5">
            {EXPLORE_TABS.map((candidate) => {
              const active = candidate === tab;
              return (
                <button
                  key={candidate}
                  id={tabId(candidate)}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={PANEL_ID}
                  onClick={() => onChange(candidate)}
                  className={cn(
                    'relative py-3 font-medium text-sm outline-none ring-ring transition-colors focus-visible:ring-2',
                    active
                      ? 'text-brand-orange-text'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {TAB_LABEL[candidate]}
                  {active ? (
                    <motion.span
                      layoutId="explore-tab-underline"
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { type: 'spring', bounce: 0.2, visualDuration: 0.25 }
                      }
                      className="-bottom-px absolute inset-x-0 h-0.5 rounded-full bg-metricyak-brand-orange"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </LayoutGroup>
        <p className="pb-3 text-muted-foreground text-xs sm:pb-0">{TAB_HINT[tab]}</p>
      </div>
      <div id={PANEL_ID} role="tabpanel" aria-labelledby={tabId(tab)}>
        {children}
      </div>
    </section>
  );
}
