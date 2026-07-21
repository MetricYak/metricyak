import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { CreateMetricInput } from '@/api/metrics';
import { Button } from '@/components/ui/button';
import { type MetricFormValues, toMetricDefinition } from './schema';

function toPayload(values: MetricFormValues): CreateMetricInput {
  return {
    name: values.name,
    description: values.description || undefined,
    definition: toMetricDefinition(values),
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
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="absolute top-2 right-2 gap-1.5 bg-card text-xs"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
      <pre className="overflow-x-auto rounded-md bg-muted p-3 pr-20 font-mono text-xs leading-relaxed">
        {json}
      </pre>
    </div>
  );
}
