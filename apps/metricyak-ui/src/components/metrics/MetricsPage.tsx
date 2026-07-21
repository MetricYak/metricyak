import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/shell/PageContainer';
import { PageTabs } from '@/components/shell/PageTabs';
import { cn } from '@/lib/utils';

type View = 'definitions' | 'explorer';

const TABS: { id: View; label: string }[] = [
  { id: 'definitions', label: 'Definitions' },
  { id: 'explorer', label: 'Explorer' },
];

function TabBar({
  view,
  onChange,
}: {
  view: View;
  onChange: (v: View) => void;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  return (
    <LayoutGroup id="metrics-tabs">
      <nav>
        <ul className="flex items-stretch gap-6">
          {TABS.map((tab) => {
            const active = view === tab.id;
            return (
              <li key={tab.id}>
                <button
                  type="button"
                  onClick={() => onChange(tab.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex items-center pt-1 pb-3 font-medium text-sm transition-colors',
                    active
                      ? 'text-brand-orange-text'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab.label}
                  {active && (
                    <motion.span
                      layoutId="metrics-tab-underline"
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { type: 'spring', bounce: 0.2, visualDuration: 0.3 }
                      }
                      className="-bottom-px absolute inset-x-0 h-0.5 rounded-full bg-metricyak-brand-orange"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </LayoutGroup>
  );
}

export function MetricsPage(): React.JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const view: View = location.pathname.startsWith('/metrics/explorer') ? 'explorer' : 'definitions';

  return (
    <div className="flex h-full flex-col">
      <PageTabs>
        <TabBar view={view} onChange={(v) => navigate(`/metrics/${v}`)} />
      </PageTabs>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PageContainer width="wide" className="shrink-0 pt-5">
          <p className="text-muted-foreground text-sm">
            Turn the events you're tracking into the numbers your team watches.
          </p>
        </PageContainer>
        <div className="min-h-0 flex-1 overflow-y-auto md:overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
