import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';
import { Resizable } from '@/components/resizable/Resizable';
import { FlyoutMenuPanel } from './FlyoutMenuPanel';
import type { FlyoutMenuData } from './flyout-menu';

interface DockedFlyoutMenuProps {
  menu: FlyoutMenuData;
  onTogglePin: () => void;
}

export function DockedFlyoutMenu({ menu, onTogglePin }: DockedFlyoutMenuProps): React.JSX.Element {
  return (
    <Resizable
      side="right"
      collapsible={false}
      minWidth={240}
      maxWidth={420}
      defaultWidth={300}
      storageKey="metricyak.flyoutmenu"
      className="border-border border-r"
    >
      <FlyoutMenuPanel menu={menu} pinned onTogglePin={onTogglePin} />
    </Resizable>
  );
}

interface OverlayFlyoutMenuProps {
  menu: FlyoutMenuData | undefined;
  onTogglePin: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onDismiss: () => void;
}

export function OverlayFlyoutMenu({
  menu,
  onTogglePin,
  onPointerEnter,
  onPointerLeave,
  onDismiss,
}: OverlayFlyoutMenuProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!menu) return;
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menu, onDismiss]);

  return (
    <AnimatePresence>
      {menu ? (
        <motion.div
          key="flyout"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          className="absolute top-0 bottom-0 left-full z-(--z-flyout) w-[300px] border-border border-r bg-background shadow-[14px_0_40px_rgba(0,0,0,0.12)]"
        >
          <FlyoutMenuPanel
            menu={menu}
            pinned={false}
            onTogglePin={onTogglePin}
            onNavigate={onDismiss}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
