import type { ReactNode } from 'react';
import { DockedFlyoutMenu, OverlayFlyoutMenu } from '@/components/flyout/FlyoutMenu';
import { useFlyoutMenu } from '@/components/flyout/useFlyoutMenu';
import { OnboardingPage } from '@/components/onboarding/OnboardingPage';
import { MobileNav } from '@/components/sidebar/MobileNav';
import { navItems } from '@/components/sidebar/nav.config';
import { SidePanel } from '@/components/sidebar/SidePanel';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { MainContent } from './MainContent';

interface AppLayoutProps {
  children?: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps): React.JSX.Element {
  const { status } = useProjectContext();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const flyout = useFlyoutMenu();

  const menuFor = (id: string | undefined) =>
    id ? navItems.find((item) => item.id === id)?.menu : undefined;

  const pinnedMenu = menuFor(flyout.pinnedId);
  const overlayMenu = menuFor(flyout.overlayId);

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
    <div className="flex h-dvh w-screen overflow-hidden">
      {isDesktop && (
        <>
          <div className="relative flex shrink-0">
            <SidePanel
              openMenuId={flyout.overlayId}
              onHoverMenu={flyout.open}
              onLeaveMenu={flyout.closeAfterGrace}
            />
            <OverlayFlyoutMenu
              menu={overlayMenu}
              onTogglePin={() => flyout.overlayId && flyout.togglePin(flyout.overlayId)}
              onPointerEnter={flyout.cancelClose}
              onPointerLeave={flyout.closeAfterGrace}
              onDismiss={flyout.closeNow}
            />
          </div>
          {pinnedMenu ? (
            <DockedFlyoutMenu
              menu={pinnedMenu}
              onTogglePin={() => flyout.pinnedId && flyout.togglePin(flyout.pinnedId)}
            />
          ) : null}
        </>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {!isDesktop && <MobileNav />}
        <MainContent>{children}</MainContent>
      </div>
    </div>
  );
}
