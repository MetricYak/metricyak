import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listRecentEvents, type RealEvent } from '@/api/events';
import { usePolling } from '@/hooks/usePolling';

const MAX_ROWS = 250;
const FEED_POLL_MS = 3000;
const MAX_ARRIVALS = 2000;

export interface ActivityFeed {
  items: RealEvent[];
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
  const [items, setItems] = useState<RealEvent[]>([]);
  const [buffer, setBuffer] = useState<RealEvent[]>([]);
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());
  const [live, setLiveState] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const liveRef = useRef(live);
  const atTopRef = useRef(true);
  const followingRef = useRef(true);
  const arrivalsRef = useRef<number[]>([]);
  const itemsRef = useRef<RealEvent[]>([]);
  itemsRef.current = items;
  const bufferRef = useRef<RealEvent[]>([]);
  bufferRef.current = buffer;

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

    return () => {
      active = false;
    };
  }, [projectId, reloadKey]);

  // Newly-seen events go straight to the visible rows while the user is following
  // the top of the feed, and into the buffer otherwise so the "new events" count
  // is what interrupts them — never a list that jumps under the cursor.
  const absorbArrivals = useCallback((recent: readonly RealEvent[]): void => {
    const known = new Set([...itemsRef.current, ...bufferRef.current].map((event) => event.id));
    const arrived = recent.filter((event) => !known.has(event.id));
    if (arrived.length === 0) return;

    const arrivedAt = Date.now();
    arrivalsRef.current = [...arrivalsRef.current, ...arrived.map(() => arrivedAt)].slice(
      -MAX_ARRIVALS,
    );

    if (followingRef.current) {
      setItems((prev) => [...arrived, ...prev].slice(0, MAX_ROWS));
      setFreshIds(new Set(arrived.map((event) => event.id)));
      return;
    }
    setBuffer((prev) => [...arrived, ...prev]);
  }, []);

  usePolling(
    () => {
      if (!projectId) return;
      listRecentEvents(projectId)
        .then(absorbArrivals)
        .catch(() => undefined);
    },
    FEED_POLL_MS,
    projectId != null,
  );

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
