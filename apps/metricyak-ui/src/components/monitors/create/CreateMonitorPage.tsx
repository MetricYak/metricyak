import { zodResolver } from '@hookform/resolvers/zod';
import { BellRing } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { type Path, useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { listMetrics, type Metric } from '@/api/metrics';
import { createMonitor } from '@/api/monitors';
import { defaultMonitorName } from '@/components/monitors/condition-sentence';
import { PageContainer } from '@/components/shell/PageContainer';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Surface } from '@/components/ui/surface';
import { Textarea } from '@/components/ui/textarea';
import { useProjectContext } from '@/contexts/ProjectContext';
import { ApiError } from '@/lib/api';
import { MonitorPreviewPanel } from './MonitorPreviewPanel';
import {
  availableOperatorOptions,
  defaultMonitorFormValues,
  HOLD_FOR_OPTIONS,
  MISSING_DATA_OPTIONS,
  type MonitorFormValues,
  monitorFormSchema,
  toCreateMonitorInput,
  WINDOW_OPTIONS,
} from './schema';

function toFieldPath(attribute: string): string {
  return attribute.replace(/^condition\./, '');
}

export function CreateMonitorPage(): React.JSX.Element {
  const { activeProject } = useProjectContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const metricParam = searchParams.get('metric');

  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showDiscard, setShowDiscard] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const form = useForm<MonitorFormValues>({
    resolver: zodResolver(monitorFormSchema),
    defaultValues: { ...defaultMonitorFormValues, metricId: metricParam ?? '' },
  });
  const { control, handleSubmit, setError, setValue, watch, formState } = form;
  const values = watch();
  const selectedMetric = metrics.find((metric) => metric.id === values.metricId) ?? null;
  const operatorOptions = useMemo(() => availableOperatorOptions(selectedMetric), [selectedMetric]);
  const isDirty = formState.isDirty && !submitting;

  useEffect(() => {
    if (!activeProject) return;
    let cancelled = false;
    listMetrics(activeProject.id)
      .then((result) => {
        if (!cancelled) setMetrics(result);
      })
      .catch(() => {
        if (!cancelled) setMetrics([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  useEffect(() => {
    if (operatorOptions.some((option) => option.value === values.operator)) return;
    const fallback = operatorOptions[0];
    if (fallback) setValue('operator', fallback.value);
  }, [operatorOptions, values.operator, setValue]);

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
    else navigate('/monitors');
  };

  const onSubmit = async (formValues: MonitorFormValues): Promise<void> => {
    if (!activeProject) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const monitor = await createMonitor(
        activeProject.id,
        toCreateMonitorInput(formValues, selectedMetric),
      );
      toast.success('Monitor created', { description: monitor.name });
      navigate('/monitors');
    } catch (error) {
      if (error instanceof ApiError) {
        let appliedToField = false;
        for (const item of error.errors) {
          if (item.attribute) {
            setError(toFieldPath(item.attribute) as Path<MonitorFormValues>, {
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

  const namePlaceholder =
    selectedMetric && values.value != null && Number.isFinite(values.value)
      ? defaultMonitorName({
          metricName: selectedMetric.name,
          operator: values.operator,
          value: values.value,
        })
      : 'Name this monitor';

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={BellRing}
        title="New monitor"
        description="Watch a metric and get told the moment it crosses the line."
        backTo="/monitors"
        backLabel="Back to monitors"
        onBackClick={(event) => {
          event.preventDefault();
          requestLeave();
        }}
      />

      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <PageContainer width="wide" className="py-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,720px)_minmax(0,1fr)]">
                <div className="min-w-0 space-y-6">
                  <Surface padding="lg" className="space-y-4">
                    <FormField
                      control={control}
                      name="metricId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Metric</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Choose a metric to watch" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {metrics.map((metric) => (
                                <SelectItem key={metric.id} value={metric.id}>
                                  {metric.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {metrics.length === 0 ? (
                            <p className="text-muted-foreground text-sm">
                              No metrics yet — create one first, then point a monitor at it.
                            </p>
                          ) : null}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex flex-wrap items-end gap-3">
                      <FormField
                        control={control}
                        name="operator"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Condition</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {operatorOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={control}
                        name="value"
                        render={({ field }) => (
                          <FormItem className="w-32">
                            <FormLabel>Value</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="any"
                                placeholder="5000"
                                {...field}
                                onChange={(event) => field.onChange(event.target.valueAsNumber)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={control}
                        name="window"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Over</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {WINDOW_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>
                    {formState.errors.value ? (
                      <p className="text-destructive text-sm">{formState.errors.value.message}</p>
                    ) : null}
                  </Surface>

                  <Surface padding="lg" className="space-y-4">
                    <FormField
                      control={control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder={namePlaceholder} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              rows={2}
                              placeholder="What should the team do when this fires?"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </Surface>

                  <Surface padding="lg" className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced((current) => !current)}
                      className="font-medium text-foreground text-sm hover:underline"
                    >
                      {showAdvanced ? 'Hide advanced' : 'Advanced'}
                    </button>
                    {showAdvanced ? (
                      <div className="flex flex-wrap gap-4">
                        <FormField
                          control={control}
                          name="holdFor"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Fire</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {HOLD_FOR_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={control}
                          name="missingData"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>When data is missing</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {MISSING_DATA_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>
                    ) : null}
                  </Surface>
                </div>

                <aside className="sticky top-0 z-10 order-first lg:top-6 lg:order-none lg:self-start">
                  <MonitorPreviewPanel
                    metricName={selectedMetric?.name ?? null}
                    operator={values.operator}
                    value={values.value}
                    window={values.window}
                    holdFor={values.holdFor}
                  />
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
                {submitting ? 'Creating…' : 'Create monitor'}
              </Button>
            </PageContainer>
          </footer>
        </form>
      </Form>

      <ConfirmDialog
        open={showDiscard}
        title="Discard this monitor?"
        description="Your changes will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => navigate('/monitors')}
        onCancel={() => setShowDiscard(false)}
      />
    </div>
  );
}
