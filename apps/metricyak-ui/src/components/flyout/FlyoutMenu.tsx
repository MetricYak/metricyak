import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';
import { FlyoutMenuPanel } from './FlyoutMenuPanel';
import type { FlyoutMenuData } from './flyout-menu';

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export interface SectionMenu {
  id: string;
  title: string;
  menu: FlyoutMenuData;
}

interface FlyoutMenuProps {
  section: SectionMenu | undefined;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onDismiss: () => void;
}

export function FlyoutMenu({
  section,
  onPointerEnter,
  onPointerLeave,
  onDismiss,
}: FlyoutMenuProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!section) return;
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [section, onDismiss]);

  return (
    <AnimatePresence>
      {section ? (
        <motion.div
          key="section-menu"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
          transition={{ duration: 0.15, ease: EASE_OUT }}
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          className="absolute top-0 bottom-0 left-full z-(--z-flyout) w-64 border-sidebar-border border-r bg-sidebar-panel"
        >
          <FlyoutMenuPanel title={section.title} menu={section.menu} onNavigate={onDismiss} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
