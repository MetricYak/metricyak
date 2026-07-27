import type { SummaryTile } from './explore-model';

export function MetricSummaryTiles({
  tiles,
}: {
  tiles: readonly SummaryTile[];
}): React.JSX.Element {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="flex flex-col gap-1 rounded-lg border border-border bg-card px-4 py-3"
        >
          <dt className="text-muted-foreground text-xs">{tile.label}</dt>
          <dd className="-tracking-[0.01em] font-semibold text-2xl text-foreground tabular-nums">
            {tile.value}
          </dd>
          <p className="truncate font-mono text-[11px] text-muted-foreground" title={tile.footnote}>
            {tile.footnote}
          </p>
        </div>
      ))}
    </dl>
  );
}
