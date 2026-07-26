import { useEffect, useRef } from 'react';

/**
 * Re-runs `onTick` on an interval while the tab is visible.
 *
 * A hidden tab stops polling entirely, and becoming visible again ticks
 * immediately rather than waiting out the remaining interval — switching back
 * from a terminal should show current data, not data from before you left.
 */
export function usePolling(onTick: () => void, intervalMs: number, enabled = true): void {
  const latestTick = useRef(onTick);
  latestTick.current = onTick;

  useEffect(() => {
    if (!enabled) return;

    let timer: number | undefined;

    const stop = (): void => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };

    const start = (): void => {
      stop();
      timer = window.setInterval(() => latestTick.current(), intervalMs);
    };

    const syncToVisibility = (): void => {
      if (document.hidden) {
        stop();
        return;
      }
      latestTick.current();
      start();
    };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', syncToVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', syncToVisibility);
    };
  }, [intervalMs, enabled]);
}
