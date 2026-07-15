import { SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { METRIC_AGGREGATIONS } from '@/api/metrics';
import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EventCombobox } from './EventCombobox';
import type { MetricFormValues } from './schema';

const AGGREGATION_LABEL: Record<(typeof METRIC_AGGREGATIONS)[number], string> = {
  count: 'Count',
  sum: 'Sum',
  average: 'Average',
  min: 'Min',
  max: 'Max',
};

interface EventFieldGroupProps {
  index: number;
  onRemove?: () => void;
}

export function EventFieldGroup({ index, onRemove }: EventFieldGroupProps): React.JSX.Element {
  const {
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<MetricFormValues>();
  const [customizing, setCustomizing] = useState(false);
  const aggregation = watch(`events.${index}.aggregation`);
  const hasCustomError = Boolean(errors.events?.[index]?.key || errors.events?.[index]?.source);

  useEffect(() => {
    if (hasCustomError) setCustomizing(true);
  }, [hasCustomError]);

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start gap-2">
        <FormField
          control={control}
          name={`events.${index}.aggregation`}
          render={({ field }) => (
            <FormItem className="shrink-0">
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {METRIC_AGGREGATIONS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {AGGREGATION_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <span className="mt-2 shrink-0 text-muted-foreground text-sm">of</span>

        <FormField
          control={control}
          name={`events.${index}.type`}
          render={({ field }) => (
            <FormItem className="min-w-56 flex-1">
              <FormControl>
                <EventCombobox
                  value={field.value}
                  onSelect={(event) => {
                    field.onChange(event.name);
                    if (!watch(`events.${index}.key`)) {
                      setValue(`events.${index}.key`, event.name, { shouldValidate: true });
                    }
                    if (event.source) {
                      setValue(`events.${index}.source`, event.source, { shouldValidate: true });
                    }
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label="Remove event"
            className="mt-0.5 shrink-0 text-muted-foreground"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      {aggregation !== 'count' ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm">on</span>
          <FormField
            control={control}
            name={`events.${index}.field`}
            render={({ field }) => (
              <FormItem className="min-w-48 flex-1">
                <FormControl>
                  <Input {...field} placeholder="e.g. amount_usd" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      ) : null}

      {customizing ? (
        <div className="mt-3 grid gap-3 border-border border-t pt-3 sm:grid-cols-2">
          <FormField
            control={control}
            name={`events.${index}.key`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-normal text-muted-foreground text-xs">
                  Refer to this event as
                </FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. signups" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`events.${index}.source`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-normal text-muted-foreground text-xs">Source</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. web" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCustomizing(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-muted-foreground text-xs hover:text-foreground"
        >
          <SlidersHorizontal className="size-3" />
          Customize name &amp; source
        </button>
      )}
    </div>
  );
}
