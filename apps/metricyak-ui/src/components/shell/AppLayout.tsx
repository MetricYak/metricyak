import { type ReactNode, useState } from 'react';
import { OnboardingPage } from '@/components/onboarding/OnboardingPage';
import { navItems } from '@/components/sidebar/nav.config';
import { SidePanel } from '@/components/sidebar/SidePanel';
import { SubMenuPanel } from '@/components/sidebar/SubMenuPanel';
import { useProjectContext } from '@/contexts/ProjectContext';
import { MainContent } from './MainContent';

interface AppLayoutProps {
  children?: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps): React.JSX.Element {
  const { status } = useProjectContext();
  const [activeSubMenuId, setActiveSubMenuId] = useState<string | undefined>(undefined);

  const activeItem = activeSubMenuId
    ? navItems.find((item) => item.id === activeSubMenuId)
    : undefined;

  const handleOpenSubMenu = (id: string): void => {
    setActiveSubMenuId((current) => (current === id ? undefined : id));
  };

  if (status === 'needs-onboarding') {
    return <OnboardingPage />;
  }

  if (status === 'error') {
    return (
      <div className="flex h-screen w-screen items-center justify-center p-6 text-center">
        <div className="space-y-2">
          <h1 className="text-lg font-semibold">Can’t reach the API</h1>
          <p className="text-sm text-muted-foreground">
            The MetricYak backend isn’t responding. Check that it’s running, then reload.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <SidePanel activeSubMenuId={activeSubMenuId} onOpenSubMenu={handleOpenSubMenu} />
      {activeItem?.items?.length ? (
        <SubMenuPanel item={activeItem} onClose={() => setActiveSubMenuId(undefined)} />
      ) : null}
      <MainContent>{children}</MainContent>
    </div>
  );
}
