import { X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NavItem } from './NavItem';
import { NavList } from './NavList';
import { bottomNavItems, type NavItemData } from './nav.config';
import { ProjectSwitcher } from './ProjectSwitcher';
import { SidePanelBody } from './SidePanelBody';

interface MobileMenuDrawerProps {
  open: boolean;
  onClose: () => void;
  activeSubMenuId?: string;
  onOpenSubMenu: (id: string) => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function useFocusTrap(
  panelRef: React.RefObject<HTMLDivElement | null>,
  open: boolean,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE);
    firstFocusable?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose, panelRef]);
}

export function MobileMenuDrawer({
  open,
  onClose,
  activeSubMenuId,
  onOpenSubMenu,
}: MobileMenuDrawerProps): React.JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useFocusTrap(panelRef, open, onClose);

  const slide = shouldReduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { x: '-100%' }, animate: { x: 0 }, exit: { x: '-100%' } };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-(--z-drawer) md:hidden">
          <motion.button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-(--z-drawer-backdrop) cursor-default bg-metricyak-950/45"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            initial={slide.initial}
            animate={slide.animate}
            exit={slide.exit}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-y-0 left-0 z-(--z-drawer) flex w-[min(18rem,85vw)] flex-col border-sidebar-border border-r bg-sidebar-bg text-sidebar-foreground shadow-xl"
          >
            <div className="flex shrink-0 items-center gap-1 border-sidebar-border border-b p-2">
              <div className="min-w-0 flex-1">
                <ProjectSwitcher collapsed={false} />
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <SidePanelBody>
              <NavList activeId={activeSubMenuId} onOpenSubMenu={onOpenSubMenu} />
            </SidePanelBody>

            <div className="shrink-0 px-2 pb-2">
              {bottomNavItems.map((item: NavItemData) => (
                <NavItem key={item.id} item={item} onOpenSubMenu={onOpenSubMenu} />
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
