import { type RefObject, useCallback, useRef, useState } from 'react';

export type ResizeSide = 'left' | 'right';

export interface UseResizableOptions {
  side?: ResizeSide;
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
  collapsible?: boolean;
  collapseThreshold?: number;
  collapsedWidth?: number;
  /** Pixels to move per arrow-key press (Shift = 4x). */
  keyboardStep?: number;
  storageKey?: string;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export interface ResizeHandleProps {
  onPointerDown: (event: React.PointerEvent) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  role: 'separator';
  'aria-orientation': 'vertical';
  'aria-valuemin': number;
  'aria-valuemax': number;
  'aria-valuenow': number;
  tabIndex: 0;
}

export interface UseResizableResult {
  panelRef: RefObject<HTMLDivElement | null>;
  handleProps: ResizeHandleProps;
  renderWidth: number;
  width: number;
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
}

interface StoredState {
  width: number;
  collapsed: boolean;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), hi);
}

function readStored(key: string): Partial<StoredState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<StoredState>) : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, state: StoredState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    return;
  }
}

export function useResizable(options: UseResizableOptions): UseResizableResult {
  const {
    side = 'right',
    minWidth,
    maxWidth,
    defaultWidth,
    collapsible = true,
    collapseThreshold = 0,
    collapsedWidth = 0,
    keyboardStep = 16,
    storageKey,
    onCollapsedChange,
  } = options;

  const panelRef = useRef<HTMLDivElement | null>(null);

  const [width, setWidth] = useState<number>(() => {
    const stored = storageKey ? readStored(storageKey) : null;
    return clamp(stored?.width ?? defaultWidth, minWidth, maxWidth);
  });
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    const stored = storageKey ? readStored(storageKey) : null;
    return stored?.collapsed ?? false;
  });

  // During a drag we update width imperatively (one DOM write per frame) for
  // smoothness, but the discrete collapsed flag is mirrored into React state the
  // instant it flips so anything reading `collapsed` (e.g. the nav highlight)
  // stays in sync with the live layout. `data-collapsed` is owned solely by React.
  const applyWidth = useCallback((domWidth: number): void => {
    const el = panelRef.current;
    if (!el) return;
    el.style.width = `${domWidth}px`;
  }, []);

  const persist = useCallback(
    (nextWidth: number, isCollapsed: boolean): void => {
      if (storageKey) writeStored(storageKey, { width: nextWidth, collapsed: isCollapsed });
    },
    [storageKey],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent): void => {
      const el = panelRef.current;
      if (!el) return;
      event.preventDefault();

      const startX = event.clientX;
      const startWidth = el.getBoundingClientRect().width;
      const startCollapsed = collapsed;
      let nextWidth = width;
      let nextCollapsed = collapsed;
      let frame = 0;

      el.dataset.resizing = 'true';
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (moveEvent: PointerEvent): void => {
        const delta = moveEvent.clientX - startX;
        const raw = side === 'left' ? startWidth - delta : startWidth + delta;

        let domWidth: number;
        let movedCollapsed: boolean;
        if (collapsible && raw < collapseThreshold) {
          movedCollapsed = true;
          domWidth = collapsedWidth;
        } else {
          movedCollapsed = false;
          nextWidth = clamp(raw, minWidth, maxWidth);
          domWidth = nextWidth;
        }

        // Mirror the collapsed flip into React immediately (it changes rarely,
        // only when crossing the threshold) so dependent UI doesn't lag the drag.
        if (movedCollapsed !== nextCollapsed) {
          nextCollapsed = movedCollapsed;
          setCollapsedState(nextCollapsed);
        }

        if (!frame) {
          frame = requestAnimationFrame(() => {
            frame = 0;
            applyWidth(domWidth);
          });
        }
      };

      const onUp = (): void => {
        if (frame) cancelAnimationFrame(frame);
        applyWidth(nextCollapsed ? collapsedWidth : nextWidth);
        el.dataset.resizing = 'false';
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);

        setWidth(nextWidth);
        // Notify consumers (e.g. close-on-collapse) only once the drag commits,
        // never mid-drag — otherwise the panel could unmount under the pointer.
        if (nextCollapsed !== startCollapsed) onCollapsedChange?.(nextCollapsed);
        persist(nextWidth, nextCollapsed);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [
      applyWidth,
      collapseThreshold,
      collapsed,
      collapsedWidth,
      collapsible,
      maxWidth,
      minWidth,
      onCollapsedChange,
      persist,
      side,
      width,
    ],
  );

  const setCollapsed = useCallback(
    (value: boolean): void => {
      setCollapsedState(value);
      onCollapsedChange?.(value);
      persist(width, value);
    },
    [onCollapsedChange, persist, width],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent): void => {
      let direction = 0;
      if (event.key === 'ArrowLeft') direction = -1;
      else if (event.key === 'ArrowRight') direction = 1;
      else return;

      event.preventDefault();
      const magnitude = event.shiftKey ? keyboardStep * 4 : keyboardStep;
      const signed = side === 'left' ? -magnitude : magnitude;
      const target = (collapsed ? collapsedWidth : width) + direction * signed;

      if (collapsible && target < collapseThreshold) {
        setCollapsed(true);
        return;
      }

      const next = clamp(target, minWidth, maxWidth);
      setWidth(next);
      if (collapsed) {
        setCollapsedState(false);
        onCollapsedChange?.(false);
      }
      persist(next, false);
    },
    [
      collapseThreshold,
      collapsed,
      collapsedWidth,
      collapsible,
      keyboardStep,
      maxWidth,
      minWidth,
      onCollapsedChange,
      persist,
      setCollapsed,
      side,
      width,
    ],
  );

  const renderWidth = collapsed ? collapsedWidth : width;

  return {
    panelRef,
    handleProps: {
      onPointerDown,
      onKeyDown,
      role: 'separator',
      'aria-orientation': 'vertical',
      'aria-valuemin': minWidth,
      'aria-valuemax': maxWidth,
      'aria-valuenow': renderWidth,
      tabIndex: 0,
    },
    renderWidth,
    width,
    collapsed,
    setCollapsed,
  };
}
