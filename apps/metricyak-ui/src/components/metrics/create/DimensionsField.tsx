import { X } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { MetricFormValues } from './schema';

const MAX_DIMENSIONS = 16;

export function DimensionsField(): React.JSX.Element {
  const { control } = useFormContext<MetricFormValues>();
  const [draft, setDraft] = useState('');

  return (
    <FormField
      control={control}
      name="dimensions"
      render={({ field }) => {
        const dimensions = field.value ?? [];

        const addDimension = (): void => {
          const value = draft.trim();
          if (!value || dimensions.includes(value) || dimensions.length >= MAX_DIMENSIONS) return;
          field.onChange([...dimensions, value]);
          setDraft('');
        };

        const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            addDimension();
          }
        };

        return (
          <FormItem>
            <FormLabel>Break down by (optional)</FormLabel>
            <p className="text-muted-foreground text-xs">
              Property names to slice this metric by later, e.g. plan or country.
            </p>
            <FormControl>
              <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input px-2 py-1.5">
                {dimensions.map((dimension) => (
                  <Badge key={dimension} variant="secondary" className="gap-1 pr-1">
                    {dimension}
                    <button
                      type="button"
                      onClick={() => field.onChange(dimensions.filter((d) => d !== dimension))}
                      aria-label={`Remove ${dimension}`}
                      className="rounded-sm hover:bg-metricyak-300"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
                {dimensions.length < MAX_DIMENSIONS ? (
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={addDimension}
                    placeholder={dimensions.length === 0 ? 'e.g. plan, country' : 'Add another…'}
                    className="min-w-32 flex-1 border-none bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
                  />
                ) : null}
              </div>
            </FormControl>
            {dimensions.length >= MAX_DIMENSIONS ? (
              <p className="text-muted-foreground text-xs">
                That's the limit — a metric can break down by up to {MAX_DIMENSIONS} properties.
              </p>
            ) : null}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
