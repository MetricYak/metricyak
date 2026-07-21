import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Metric } from '@/api/metrics';
import { Input } from '@/components/ui/input';
import { MetricListRow } from './MetricListRow';

export function MetricList({
  metrics,
  selectedId,
  onSelect,
}: {
  metrics: Metric[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return metrics;
    return metrics.filter((metric) => metric.name.toLowerCase().includes(needle));
  }, [metrics, query]);

  return (
    <div className="flex flex-col md:min-h-0 md:flex-1">
      <div className="relative shrink-0">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search metrics…"
          className="pl-9"
        />
      </div>
      <div className="mt-3 space-y-0.5 md:min-h-0 md:flex-1 md:overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-muted-foreground text-sm">
            No metrics match “{query}”.
          </p>
        ) : (
          filtered.map((metric) => (
            <MetricListRow
              key={metric.id}
              metric={metric}
              selected={metric.id === selectedId}
              onSelect={() => onSelect(metric.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
