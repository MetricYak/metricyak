import { BellRing } from 'lucide-react';
import type { ConditionOperator } from '@/api/monitors';
import { conditionSentence } from '@/components/monitors/condition-sentence';
import { Surface } from '@/components/ui/surface';

interface MonitorPreviewPanelProps {
  metricName: string | null;
  operator: ConditionOperator;
  value: number | undefined;
  window: string;
  holdFor: string;
}

export function MonitorPreviewPanel({
  metricName,
  operator,
  value,
  window,
  holdFor,
}: MonitorPreviewPanelProps): React.JSX.Element {
  const ready = metricName != null && value != null && Number.isFinite(value);
  return (
    <Surface padding="lg" className="space-y-3">
      <div className="flex items-center gap-2">
        <BellRing className="size-4 text-metricyak-brand-orange" />
        <h2 className="font-semibold text-foreground text-sm">Preview</h2>
      </div>
      <p className="text-foreground text-sm leading-relaxed">
        {ready
          ? conditionSentence({
              metricName: metricName ?? '',
              operator,
              value: value ?? 0,
              window,
              holdFor,
              long: true,
            })
          : 'Pick a metric and a threshold to see what this monitor will do.'}
      </p>
    </Surface>
  );
}
