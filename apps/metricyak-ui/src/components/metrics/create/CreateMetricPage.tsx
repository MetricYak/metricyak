import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Braces, PenLine, Plus } from 'lucide-react';
import { useState } from 'react';
import { FormProvider, type Path, useFieldArray, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { createMetric } from '@/api/metrics';
import { Button } from '@/components/ui/button';
import { useProjectContext } from '@/contexts/ProjectContext';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DimensionsField } from './DimensionsField';
import { EventFieldGroup } from './EventFieldGroup';
import { FormulaField } from './FormulaField';
import { MetricBasicsFields } from './MetricBasicsFields';
import { MetricJsonPreview } from './MetricJsonPreview';
import {
  defaultMetricFormValues,
  emptyEvent,
  type MetricFormValues,
  metricFormSchema,
} from './schema';

type View = 'visual' | 'json';

// Backend attribute paths are prefixed with "definition." (e.g. "definition.events.0.field");
// form field paths drop that prefix since the form only models the definition's contents.
function toFieldPath(attribute: string): string {
  return attribute.replace(/^definition\./, '');
}

export function CreateMetricPage(): React.JSX.Element {
  const { activeProject } = useProjectContext();
  const navigate = useNavigate();
  const [view, setView] = useState<View>('visual');
  const [dimensionsOpen, setDimensionsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<MetricFormValues>({
    resolver: zodResolver(metricFormSchema),
    defaultValues: defaultMetricFormValues,
  });
  const { control, handleSubmit, setError } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'events' });
  const events = form.watch('events');

  const onSubmit = async (values: MetricFormValues): Promise<void> => {
    if (!activeProject) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const metric = await createMetric(activeProject.id, {
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
      });

      toast.success('Metric created', { description: metric.name });
      navigate('/metrics/definitions', { state: { highlightId: metric.id } });
    } catch (error) {
      if (error instanceof ApiError) {
        let appliedToField = false;
        for (const item of error.errors) {
          if (item.attribute) {
            setError(toFieldPath(item.attribute) as Path<MetricFormValues>, {
              message: item.message,
            });
            appliedToField = true;
          }
        }
        setSubmitError(
          appliedToField ? 'Fix the highlighted fields and try again.' : error.message,
        );
      } else {
        setSubmitError("Something went wrong on our end. We're looking into it.");
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 md:px-8">
      <Link
        to="/metrics/definitions"
        className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to definitions
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-semibold text-foreground text-xl">New metric</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Pick the events that make up this number and how they should roll up.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-md border border-border p-0.5">
          <button
            type="button"
            onClick={() => setView('visual')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 font-medium text-xs',
              view === 'visual'
                ? 'bg-metricyak-100 text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <PenLine className="size-3.5" />
            Visual
          </button>
          <button
            type="button"
            onClick={() => setView('json')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 font-medium text-xs',
              view === 'json'
                ? 'bg-metricyak-100 text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Braces className="size-3.5" />
            View as JSON
          </button>
        </div>
      </div>

      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-6">
          {view === 'json' ? (
            <MetricJsonPreview />
          ) : (
            <>
              <MetricBasicsFields />

              <section>
                <h2 className="font-semibold text-foreground text-sm">Events</h2>
                <div className="mt-2 space-y-3">
                  {fields.map((field, index) => (
                    <EventFieldGroup
                      key={field.id}
                      index={index}
                      onRemove={fields.length > 1 ? () => remove(index) : undefined}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => append(emptyEvent())}
                  className="mt-2 inline-flex items-center gap-1.5 text-metricyak-brand-orange text-sm hover:underline"
                >
                  <Plus className="size-3.5" />
                  Combine another event
                </button>
              </section>

              {events.length > 1 ? <FormulaField /> : null}

              {dimensionsOpen ? (
                <DimensionsField />
              ) : (
                <button
                  type="button"
                  onClick={() => setDimensionsOpen(true)}
                  className="inline-flex items-center gap-1.5 text-metricyak-brand-orange text-sm hover:underline"
                >
                  <Plus className="size-3.5" />
                  Add breakdown
                </button>
              )}
            </>
          )}

          <div className="flex items-center justify-end gap-2 border-border border-t pt-4">
            {submitError ? <p className="mr-auto text-destructive text-sm">{submitError}</p> : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/metrics/definitions')}
            >
              Cancel
            </Button>
            <Button type="submit" className="raised" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create metric'}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
