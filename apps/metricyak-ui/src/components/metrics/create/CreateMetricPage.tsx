import { zodResolver } from '@hookform/resolvers/zod';
import { BarChart3, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FormProvider, type Path, useFieldArray, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { createMetric } from '@/api/metrics';
import { PageContainer } from '@/components/shell/PageContainer';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Surface } from '@/components/ui/surface';
import { useProjectContext } from '@/contexts/ProjectContext';
import { ApiError } from '@/lib/api';
import { DimensionsField } from './DimensionsField';
import { useRecentlySeenEvents } from './EventCombobox';
import { EventFieldGroup } from './EventFieldGroup';
import { FirstEventCallout } from './FirstEventCallout';
import { FormulaField } from './FormulaField';
import { MetricBasicsFields } from './MetricBasicsFields';
import { MetricPreviewPanel, type PreviewView } from './MetricPreviewPanel';
import {
  defaultMetricFormValues,
  emptyEvent,
  type MetricFormValues,
  metricFormSchema,
  toMetricDefinition,
} from './schema';

function toFieldPath(attribute: string): string {
  return attribute.replace(/^definition\./, '');
}

export function CreateMetricPage(): React.JSX.Element {
  const { activeProject } = useProjectContext();
  const navigate = useNavigate();
  const [view, setView] = useState<PreviewView>('visual');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showDiscard, setShowDiscard] = useState(false);

  const form = useForm<MetricFormValues>({
    resolver: zodResolver(metricFormSchema),
    defaultValues: defaultMetricFormValues,
  });
  const { control, handleSubmit, setError } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'events' });
  const events = form.watch('events');
  const { events: seenEvents, loading: seenLoading } = useRecentlySeenEvents();
  const showFirstEventCallout = !seenLoading && seenEvents.length === 0;
  const isDirty = form.formState.isDirty && !submitting;

  useEffect(() => {
    if (!isDirty) return;
    const warnOnUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warnOnUnload);
    return () => window.removeEventListener('beforeunload', warnOnUnload);
  }, [isDirty]);

  const requestLeave = (): void => {
    if (isDirty) setShowDiscard(true);
    else navigate('/metrics/definitions');
  };

  const onSubmit = async (values: MetricFormValues): Promise<void> => {
    if (!activeProject) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const metric = await createMetric(activeProject.id, {
        name: values.name,
        description: values.description || undefined,
        definition: toMetricDefinition(values),
      });

      toast.success('Metric created', { description: metric.name });
      navigate(`/metrics/definitions?m=${encodeURIComponent(metric.id)}`, {
        state: { justCreatedId: metric.id },
      });
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
    <div className="flex h-full flex-col">
      <PageHeader
        icon={BarChart3}
        title="New metric"
        description="Choose the events this number counts and how to add them up."
        width="wide"
        backTo="/metrics/definitions"
        backLabel="Back to definitions"
        onBackClick={(event) => {
          event.preventDefault();
          requestLeave();
        }}
      />

      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <PageContainer width="wide" className="py-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,720px)_minmax(0,1fr)]">
                <div className="min-w-0 space-y-6">
                  {showFirstEventCallout ? <FirstEventCallout /> : null}

                  <Surface padding="lg">
                    <MetricBasicsFields />
                  </Surface>

                  <Surface padding="lg" className="space-y-4">
                    <div>
                      <h2 className="font-semibold text-foreground text-sm">Events</h2>
                      <p className="mt-1 text-muted-foreground text-sm">
                        Each row is an event. Keep <span className="text-foreground">Count</span> to
                        tally how often it happens, or switch to Sum/Average/Min/Max to roll up a
                        number field.
                      </p>
                    </div>
                    <div className="space-y-3">
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
                      className="inline-flex items-center gap-1.5 text-brand-orange-text text-sm hover:underline"
                    >
                      <Plus className="size-3.5" />
                      Combine another event
                    </button>
                    {events.length > 1 ? (
                      <div className="border-border border-t pt-4">
                        <FormulaField />
                      </div>
                    ) : null}
                  </Surface>

                  <Surface padding="lg">
                    <DimensionsField />
                  </Surface>
                </div>

                <aside className="sticky top-0 z-10 order-first lg:top-6 lg:order-none lg:self-start">
                  <MetricPreviewPanel view={view} onViewChange={setView} />
                </aside>
              </div>
            </PageContainer>
          </div>

          <footer className="shrink-0 border-border border-t">
            <PageContainer width="wide" className="flex items-center justify-end gap-2 py-3">
              {submitError ? (
                <p className="mr-auto text-destructive text-sm">{submitError}</p>
              ) : null}
              <Button type="button" variant="outline" onClick={requestLeave}>
                Cancel
              </Button>
              <Button type="submit" className="raised" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create metric'}
              </Button>
            </PageContainer>
          </footer>
        </form>
      </FormProvider>

      <ConfirmDialog
        open={showDiscard}
        title="Discard this metric?"
        description="Your changes will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => navigate('/metrics/definitions')}
        onCancel={() => setShowDiscard(false)}
      />
    </div>
  );
}
