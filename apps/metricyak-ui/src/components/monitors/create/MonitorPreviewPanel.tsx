import { BellRing, PauseCircle } from 'lucide-react';
import type { ConditionOperator } from '@/api/monitors';
import { previewSentence } from '@/components/monitors/condition-sentence';
import { Surface } from '@/components/ui/surface';

interface MonitorPreviewPanelProps {
  metricName: string | null;
  operator: ConditionOperator;
  value: number | undefined;
  window: string;
  holdFor: string;
  enabled: boolean;
}

export function MonitorPreviewPanel({
  metricName,
  operator,
  value,
  window,
  holdFor,
  enabled,
}: MonitorPreviewPanelProps): React.JSX.Element {
  const threshold = value != null && Number.isFinite(value) ? value : null;
  return (
    <Surface padding="lg" className="space-y-3">
      <div className="flex items-center gap-2">
        <BellRing className="size-4 text-metricyak-brand-orange" />
        <h2 className="font-semibold text-foreground text-sm">Preview</h2>
      </div>
      <p className="text-foreground text-sm leading-relaxed">
        {previewSentence({ metricName, operator, value: threshold, window, holdFor })}
      </p>
      {metricName && threshold == null ? (
        <p className="text-muted-foreground text-sm">Enter a threshold to finish the sentence.</p>
      ) : null}
      {!enabled ? (
        <p className="flex items-center gap-1.5 text-muted-foreground text-sm">
          <PauseCircle className="size-3.5" />
          Created paused — turn it on when you're ready.
        </p>
      ) : null}
    </Surface>
  );
}
