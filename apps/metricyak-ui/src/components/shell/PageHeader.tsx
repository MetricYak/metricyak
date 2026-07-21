import { ArrowLeft, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer, type PageWidth } from '@/components/shell/PageContainer';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
  width?: PageWidth;
  backTo?: string;
  backLabel?: string;
  onBackClick?: (event: React.MouseEvent) => void;
  children?: ReactNode;
}

export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  width = 'wide',
  backTo,
  backLabel = 'Back',
  onBackClick,
  children,
}: PageHeaderProps): React.JSX.Element {
  return (
    <header className="shrink-0 border-border border-b pt-7">
      <PageContainer width={width}>
        {backTo ? (
          <Link
            to={backTo}
            onClick={onBackClick}
            className="mb-3 inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {backLabel}
          </Link>
        ) : null}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 font-semibold text-foreground text-xl">
              <Icon className="size-5 text-metricyak-brand-orange" />
              {title}
            </h1>
            {description ? (
              <p className="mt-1 text-muted-foreground text-sm">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-4">{actions}</div> : null}
        </div>
        {children ? <div className="mt-6">{children}</div> : null}
      </PageContainer>
    </header>
  );
}
