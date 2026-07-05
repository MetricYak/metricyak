import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listRecentEvents, type PlatformActivity, subscribeToEvents } from '@/api/events';

const MAX_ROWS = 150;
const BACKFILL_LIMIT = 100;
const FLUSH_INTERVAL_MS = 250;
const FLUSH_COUNT = 10;

export interface ActivityFeed {
  items: PlatformActivity[];
  freshIds: Set<string>;
  pendingCount: number;
  live: boolean;
  loading: boolean;
  error: boolean;
  arrivalsRef: React.RefObject<number[]>;
  setLive: (live: boolean) => void;
  reveal: () => void;
  reload: () => void;
}

export function useActivityFeed(projectId: string | null): ActivityFeed {
  const [items, setItems] = useState<PlatformActivity[]>([]);
  const [pending, setPending] = useState<PlatformActivity[]>([]);
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());
  const [live, setLiveState] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const liveRef = useRef(live);
  const arrivalsRef = useRef<number[]>([]);

  const batchRef = useRef<PlatformActivity[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFlushTimer = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const drainBatch = useCallback(() => {
    clearFlushTimer();
    const batch = batchRef.current;
    if (batch.length === 0) return;
    batchRef.current = [];
    const newestFirst = batch.reverse();
    setPending((prev) => [...newestFirst, ...prev].slice(0, MAX_ROWS));
  }, [clearFlushTimer]);

  const reveal = useCallback(() => {
    drainBatch();
    setPending((buffered) => {
      if (buffered.length === 0) return buffered;
      setItems((prev) => [...buffered, ...prev].slice(0, MAX_ROWS));
      setFreshIds(new Set(buffered.map((b) => b.id)));
      return [];
    });
  }, [drainBatch]);

  const setLive = useCallback(
    (next: boolean) => {
      setLiveState(next);
      liveRef.current = next;
      // Pausing freezes the stream: drop any half-formed batch so resuming starts
      // clean. Whatever already reached `pending` stays revealable.
      if (!next) {
        clearFlushTimer();
        batchRef.current = [];
      }
    },
    [clearFlushTimer],
  );

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey is a manual reload trigger
  useEffect(() => {
    if (!projectId) {
      setItems([]);
      setPending([]);
      setLoading(false);
      setError(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(false);
    setPending([]);
    batchRef.current = [];
    arrivalsRef.current = [];

    listRecentEvents(projectId, BACKFILL_LIMIT)
      .then((recent) => {
        if (!active) return;
        setItems(recent.slice(0, MAX_ROWS));
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });

    const unsubscribe = subscribeToEvents(projectId, (activity) => {
      if (!active || !liveRef.current) return;

      const now = Date.now();
      const arrivals = arrivalsRef.current;
      arrivals.push(now);
      const cutoff = now - 60_000;
      while (arrivals.length && (arrivals[0] as number) < cutoff) arrivals.shift();

      batchRef.current.push(activity);
      if (batchRef.current.length >= FLUSH_COUNT) {
        drainBatch();
      } else if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(drainBatch, FLUSH_INTERVAL_MS);
      }
    });

    return () => {
      active = false;
      clearFlushTimer();
      batchRef.current = [];
      unsubscribe();
    };
  }, [projectId, reloadKey, drainBatch, clearFlushTimer]);

  useEffect(() => {
    if (freshIds.size === 0) return;
    const timer = setTimeout(() => setFreshIds(new Set()), 600);
    return () => clearTimeout(timer);
  }, [freshIds]);

  return useMemo(
    () => ({
      items,
      freshIds,
      pendingCount: pending.length,
      live,
      loading,
      error,
      arrivalsRef,
      setLive,
      reveal,
      reload,
    }),
    [items, freshIds, pending.length, live, loading, error, setLive, reveal, reload],
  );
}
