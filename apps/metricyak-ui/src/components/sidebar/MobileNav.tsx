import { Menu } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MobileMenuDrawer } from './MobileMenuDrawer';

interface MobileNavProps {
  activeSubMenuId?: string;
  onOpenSubMenu: (id: string) => void;
}

export function MobileNav({ activeSubMenuId, onOpenSubMenu }: MobileNavProps): React.JSX.Element {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const lastPathname = useRef(pathname);

  useEffect(() => {
    if (lastPathname.current !== pathname) {
      lastPathname.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  return (
    <>
      <div className="flex shrink-0 items-center border-border border-b bg-canvas px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="raised flex size-8 items-center justify-center rounded-md bg-background text-foreground"
        >
          <Menu className="size-4" />
        </button>
      </div>

      <MobileMenuDrawer
        open={open}
        onClose={() => setOpen(false)}
        activeSubMenuId={activeSubMenuId}
        onOpenSubMenu={onOpenSubMenu}
      />
    </>
  );
}
