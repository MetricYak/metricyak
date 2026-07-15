import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { CreateMetricInput } from '@/api/metrics';
import { Button } from '@/components/ui/button';
import type { MetricFormValues } from './schema';

function toPayload(values: MetricFormValues): CreateMetricInput {
  return {
    name: values.name,
    description: values.description || undefined,
    definition: {
      events: values.events.map((event) => ({
        key: event.key,
        source: event.source,
        type: event.type,
        aggregation: event.aggregation,
        field: event.aggregation === 'count' ? undefined : event.field,
      })),
      value: values.events.length > 1 ? values.value : undefined,
      dimensions: values.dimensions?.length ? values.dimensions : undefined,
    },
  };
}

export function MetricJsonPreview(): React.JSX.Element {
  const { control } = useFormContext<MetricFormValues>();
  const values = useWatch({ control });
  const [copied, setCopied] = useState(false);

  const json = JSON.stringify(toPayload(values as MetricFormValues), null, 2);

  const handleCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-lg border border-border bg-metricyak-50">
      <div className="flex items-center justify-between border-border border-b px-4 py-2">
        <span className="font-medium text-muted-foreground text-xs">
          Request payload · read-only
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 gap-1.5 text-xs"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">{json}</pre>
    </div>
  );
}
