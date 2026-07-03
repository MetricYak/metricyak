import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const WINDOW_MS = 60_000;
const BUCKET_MS = 2_000;
const BUCKET_COUNT = WINDOW_MS / BUCKET_MS;

interface ThroughputMeterProps {
  arrivalsRef: React.RefObject<number[]>;
  live: boolean;
}

export function ThroughputMeter({ arrivalsRef, live }: ThroughputMeterProps): React.JSX.Element {
  const [{ buckets, perMinute }, setState] = useState<{ buckets: number[]; perMinute: number }>({
    buckets: new Array(BUCKET_COUNT).fill(0),
    perMinute: 0,
  });

  useEffect(() => {
    const compute = (): void => {
      const now = Date.now();
      const arrivals = arrivalsRef.current ?? [];
      const buckets = new Array(BUCKET_COUNT).fill(0);
      let perMinute = 0;
      for (const ts of arrivals) {
        const age = now - ts;
        if (age < 0 || age >= WINDOW_MS) continue;
        perMinute += 1;
        const idx = BUCKET_COUNT - 1 - Math.floor(age / BUCKET_MS);
        if (idx >= 0 && idx < BUCKET_COUNT) buckets[idx] += 1;
      }
      setState({ buckets, perMinute });
    };

    compute();
    const timer = setInterval(compute, 1_000);
    return () => clearInterval(timer);
  }, [arrivalsRef]);

  const peak = Math.max(1, ...buckets);
  const lastActive = buckets.length - 1;

  return (
    <div className="flex items-center gap-2.5" aria-hidden>
      <div className="flex h-7 items-end gap-px" role="presentation">
        {buckets.map((count, i) => {
          const height = count === 0 ? 2 : Math.max(3, Math.round((count / peak) * 28));
          const isEdge = live && i === lastActive;
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length rolling window
              key={i}
              className={cn(
                'w-1 rounded-full transition-[height] duration-500 ease-out',
                count === 0 ? 'bg-metricyak-200' : isEdge ? 'bg-metricyak-600' : 'bg-metricyak-400',
              )}
              style={{ height: `${height}px` }}
            />
          );
        })}
      </div>
      <div className="whitespace-nowrap text-xs leading-tight">
        <span className="font-semibold tabular-nums text-foreground">{perMinute}</span>
        <span className="text-muted-foreground"> / min</span>
      </div>
    </div>
  );
}
