import { useFormContext, useWatch } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { MetricFormValues } from './schema';

const OPERATORS = ['+', '−', '×', '÷', '(', ')'] as const;
const OPERATOR_TO_EXPR: Record<(typeof OPERATORS)[number], string> = {
  '+': '+',
  '−': '-',
  '×': '*',
  '÷': '/',
  '(': '(',
  ')': ')',
};

function appendToken(current: string, token: string): string {
  const trimmed = current.trimEnd();
  if (!trimmed) return token;
  return `${trimmed} ${token}`;
}

export function FormulaField(): React.JSX.Element {
  const { control, setValue } = useFormContext<MetricFormValues>();
  const events = useWatch({ control, name: 'events' });
  const value = useWatch({ control, name: 'value' }) ?? '';
  const keys = events.map((event) => event.key).filter(Boolean);

  const insert = (token: string): void => {
    setValue('value', appendToken(value, token), { shouldValidate: true, shouldDirty: true });
  };

  return (
    <FormField
      control={control}
      name="value"
      render={({ field }) => (
        <FormItem>
          <FormLabel>How do these combine?</FormLabel>
          <p className="text-muted-foreground text-sm">
            Tap the events and operators to build the formula, or type it directly.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {keys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => insert(key)}
                className="inline-flex h-9 items-center rounded-md border border-border bg-metricyak-50 px-3 font-medium text-foreground text-sm hover:bg-metricyak-100"
              >
                {key}
              </button>
            ))}
            {keys.length > 0 ? <span className="mx-0.5 self-center text-border">|</span> : null}
            {OPERATORS.map((symbol) => (
              <button
                key={symbol}
                type="button"
                onClick={() => insert(OPERATOR_TO_EXPR[symbol])}
                aria-label={`Insert ${symbol}`}
                className="inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-border font-medium text-muted-foreground text-sm hover:bg-metricyak-100 hover:text-foreground"
              >
                {symbol}
              </button>
            ))}
          </div>
          <FormControl>
            <Input
              {...field}
              className="font-mono"
              placeholder={keys.length > 0 ? keys.join(' - ') : 'e.g. signups - refunds'}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
