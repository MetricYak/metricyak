import { useFormContext, useWatch } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { MetricFormValues } from './schema';

export function FormulaField(): React.JSX.Element {
  const { control } = useFormContext<MetricFormValues>();
  const events = useWatch({ control, name: 'events' });
  const keys = events.map((event) => event.key).filter(Boolean);

  return (
    <FormField
      control={control}
      name="value"
      render={({ field }) => (
        <FormItem>
          <FormLabel>How do these combine?</FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder={keys.length > 0 ? keys.join(' - ') : 'e.g. signups - refunds'}
            />
          </FormControl>
          {keys.length > 0 ? (
            <p className="text-muted-foreground text-xs">
              Use {keys.map((key) => `"${key}"`).join(', ')} in a formula, e.g.{' '}
              <code className="rounded bg-metricyak-100 px-1 py-0.5">{keys.join(' - ')}</code>
            </p>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
