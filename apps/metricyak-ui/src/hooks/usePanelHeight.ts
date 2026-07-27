import { useCallback, useEffect, useRef, useState } from 'react';

export interface UsePanelHeightOptions {
  minHeight: number;
  maxHeight: number;
  defaultHeight: number;
  keyboardStep?: number;
  storageKey?: string;
}

export interface PanelHandleProps {
  onPointerDown: (event: React.PointerEvent) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  role: 'separator';
  'aria-orientation': 'horizontal';
  'aria-valuemin': number;
  'aria-valuemax': number;
  'aria-valuenow': number;
  'aria-valuetext': string;
  tabIndex: 0;
}

export interface UsePanelHeightResult {
  height: number;
  resizing: boolean;
  handleProps: PanelHandleProps;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function readStoredHeight(storageKey: string | undefined, fallback: number): number {
  if (!storageKey) return fallback;
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Vertical counterpart to `useResizable`, which only resizes width. Dragging the handle
 * upward grows the panel, so the pointer delta is subtracted rather than added.
 */
export function usePanelHeight(options: UsePanelHeightOptions): UsePanelHeightResult {
  const { minHeight, maxHeight, defaultHeight, keyboardStep = 16, storageKey } = options;
  const [height, setHeight] = useState(() =>
    clamp(readStoredHeight(storageKey, defaultHeight), minHeight, maxHeight),
  );
  const [resizing, setResizing] = useState(false);
  const dragStart = useRef<{ y: number; height: number } | null>(null);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, String(height));
    } catch {
      // storage unavailable
    }
  }, [storageKey, height]);

  useEffect(() => {
    setHeight((current) => clamp(current, minHeight, maxHeight));
  }, [minHeight, maxHeight]);

  useEffect(() => {
    if (!resizing) return;

    const onPointerMove = (event: PointerEvent): void => {
      const start = dragStart.current;
      if (!start) return;
      setHeight(clamp(start.height - (event.clientY - start.y), minHeight, maxHeight));
    };
    const stop = (): void => {
      dragStart.current = null;
      setResizing(false);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [resizing, minHeight, maxHeight]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent): void => {
      event.preventDefault();
      dragStart.current = { y: event.clientY, height };
      setResizing(true);
    },
    [height],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent): void => {
      const step = event.shiftKey ? keyboardStep * 4 : keyboardStep;
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHeight((current) => clamp(current + step, minHeight, maxHeight));
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHeight((current) => clamp(current - step, minHeight, maxHeight));
      }
    },
    [keyboardStep, minHeight, maxHeight],
  );

  return {
    height,
    resizing,
    handleProps: {
      onPointerDown,
      onKeyDown,
      role: 'separator',
      'aria-orientation': 'horizontal',
      'aria-valuemin': minHeight,
      'aria-valuemax': maxHeight,
      'aria-valuenow': height,
      'aria-valuetext': `Events panel ${height} pixels tall`,
      tabIndex: 0,
    },
  };
}
