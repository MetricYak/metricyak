import { type ReactNode, useState } from 'react';
import { navItems } from '@/components/sidebar/nav.config';
import { SidePanel } from '@/components/sidebar/SidePanel';
import { SubMenuPanel } from '@/components/sidebar/SubMenuPanel';
import { MainContent } from './MainContent';

interface AppLayoutProps {
  children?: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps): React.JSX.Element {
  const [activeSubMenuId, setActiveSubMenuId] = useState<string | undefined>(undefined);

  const activeItem = activeSubMenuId
    ? navItems.find((item) => item.id === activeSubMenuId)
    : undefined;

  const handleOpenSubMenu = (id: string): void => {
    setActiveSubMenuId((current) => (current === id ? undefined : id));
  };

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
