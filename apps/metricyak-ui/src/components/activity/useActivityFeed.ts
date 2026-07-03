import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listRecentEvents, type PlatformActivity, subscribeToEvents } from '@/api/events';

const MAX_ROWS = 250;

export interface ActivityFeed {
  items: PlatformActivity[];
  freshIds: Set<string>;
  bufferedCount: number;
  live: boolean;
  loading: boolean;
  error: boolean;
  arrivalsRef: React.RefObject<number[]>;
  setLive: (live: boolean) => void;
  setAtTop: (atTop: boolean) => void;
  flush: () => void;
  reload: () => void;
}

export function useActivityFeed(projectId: string | null): ActivityFeed {
  const [items, setItems] = useState<PlatformActivity[]>([]);
  const [buffer, setBuffer] = useState<PlatformActivity[]>([]);
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());
  const [live, setLiveState] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const liveRef = useRef(live);
  const atTopRef = useRef(true);
  const followingRef = useRef(true);
  const arrivalsRef = useRef<number[]>([]);

  const recomputeFollowing = useCallback((): boolean => {
    followingRef.current = liveRef.current && atTopRef.current;
    return followingRef.current;
  }, []);

  const flush = useCallback(() => {
    setBuffer((buffered) => {
      if (buffered.length === 0) return buffered;
      setItems((prev) => [...buffered, ...prev].slice(0, MAX_ROWS));
      return [];
    });
  }, []);

  const setLive = useCallback(
    (next: boolean) => {
      setLiveState(next);
      liveRef.current = next;
      if (recomputeFollowing()) flush();
    },
    [recomputeFollowing, flush],
  );

  const setAtTop = useCallback(
    (atTop: boolean) => {
      if (atTopRef.current === atTop) return;
      atTopRef.current = atTop;
      if (recomputeFollowing()) flush();
    },
    [recomputeFollowing, flush],
  );

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey is a manual reload trigger
  useEffect(() => {
    if (!projectId) {
      setItems([]);
      setBuffer([]);
      setLoading(false);
      setError(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(false);
    setBuffer([]);
    arrivalsRef.current = [];

    listRecentEvents(projectId)
      .then((recent) => {
        if (!active) return;
        setItems(recent);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });

    const unsubscribe = subscribeToEvents(projectId, (activity) => {
      if (!active) return;

      const now = Date.now();
      const arrivals = arrivalsRef.current;
      arrivals.push(now);
      const cutoff = now - 60_000;
      while (arrivals.length && (arrivals[0] as number) < cutoff) arrivals.shift();

      if (followingRef.current) {
        setItems((prev) => [activity, ...prev].slice(0, MAX_ROWS));
        setFreshIds((prev) => {
          const next = new Set(prev);
          next.add(activity.id);
          return next;
        });
      } else {
        setBuffer((prev) => [activity, ...prev]);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [projectId, reloadKey]);

  useEffect(() => {
    if (freshIds.size === 0) return;
    const timer = setTimeout(() => setFreshIds(new Set()), 600);
    return () => clearTimeout(timer);
  }, [freshIds]);

  return useMemo(
    () => ({
      items,
      freshIds,
      bufferedCount: buffer.length,
      live,
      loading,
      error,
      arrivalsRef,
      setLive,
      setAtTop,
      flush,
      reload,
    }),
    [items, freshIds, buffer.length, live, loading, error, setLive, setAtTop, flush, reload],
  );
}
