import type { ExploreMetric, MetricKind, SummaryTile, WindowStats } from './explore-model';
import { GRANULARITY_NOUN, type Granularity } from './granularity';
import { formatChangeRatio, formatCount, formatMetricAmount } from './value-format';

const LEAD_LABEL: Readonly<Record<MetricKind, string>> = {
  count: 'Total over selection',
  sum: 'Total over selection',
  average: 'Average over selection',
  min: 'Lowest over selection',
  max: 'Highest over selection',
  ratio: 'Rate over selection',
};

function changeTile(metric: ExploreMetric, stats: WindowStats): SummaryTile {
  return {
    label: 'Change vs prior window',
    value: formatChangeRatio(stats.changeRatio),
    footnote:
      stats.baseline === null
        ? 'no prior window to compare'
        : `prior ${formatMetricAmount(stats.baseline, metric.valueFormat)}`,
  };
}

export function summaryTilesFor(
  metric: ExploreMetric,
  stats: WindowStats,
  granularity: Granularity,
): SummaryTile[] {
  return [
    {
      label: LEAD_LABEL[metric.kind],
      value: formatMetricAmount(stats.value, metric.valueFormat),
      footnote: metric.expression,
    },
    changeTile(metric, stats),
    {
      label: 'Highest bucket',
      value: formatMetricAmount(stats.peak, metric.valueFormat),
      footnote: `highest single ${GRANULARITY_NOUN[granularity]}`,
    },
    {
      label: 'Buckets with data',
      value: formatCount(stats.pointCount),
      footnote: `${GRANULARITY_NOUN[granularity]} buckets with a recorded value`,
    },
  ];
}
