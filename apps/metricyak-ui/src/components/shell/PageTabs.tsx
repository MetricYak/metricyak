import type { ReactNode } from 'react';
import { PageContainer, type PageWidth } from '@/components/shell/PageContainer';

interface PageTabsProps {
  width?: PageWidth;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageTabs({ width = 'wide', actions, children }: PageTabsProps): React.JSX.Element {
  return (
    <div className="shrink-0 border-border border-b">
      <PageContainer width={width} className="flex items-center justify-between gap-4 pt-3 md:pt-4">
        <div className="min-w-0">{children}</div>
        {actions ? <div className="flex shrink-0 items-center gap-4">{actions}</div> : null}
      </PageContainer>
    </div>
  );
}
