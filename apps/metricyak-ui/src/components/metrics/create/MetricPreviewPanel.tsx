import { Braces, ChevronRight, type LucideIcon, PenLine } from 'lucide-react';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { DefinitionSummary } from '@/components/metrics/definitions/DefinitionSummary';
import { Surface } from '@/components/ui/surface';
import { cn } from '@/lib/utils';
import { MetricJsonPreview } from './MetricJsonPreview';
import { type MetricFormValues, toMetricDefinition } from './schema';

export type PreviewView = 'visual' | 'json';

export function MetricPreviewPanel({
  view,
  onViewChange,
}: {
  view: PreviewView;
  onViewChange: (view: PreviewView) => void;
}): React.JSX.Element {
  const { control } = useFormContext<MetricFormValues>();
  const values = useWatch({ control }) as MetricFormValues;
  const name = values.name?.trim();
  const [open, setOpen] = useState(false);

  return (
    <Surface padding="none" className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-border border-b px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          className="flex items-center gap-1 font-medium text-muted-foreground text-xs lg:pointer-events-none"
        >
          <ChevronRight
            className={cn('size-4 transition-transform lg:hidden', open && 'rotate-90')}
          />
          Preview
        </button>
        <div
          className={cn(
            'items-center gap-0.5 rounded-md border border-border p-0.5',
            open ? 'flex' : 'hidden lg:flex',
          )}
        >
          <ToggleButton
            active={view === 'visual'}
            onClick={() => onViewChange('visual')}
            icon={PenLine}
            label="Visual"
          />
          <ToggleButton
            active={view === 'json'}
            onClick={() => onViewChange('json')}
            icon={Braces}
            label="JSON"
          />
        </div>
      </div>
      <div className={cn('p-4', open ? 'block' : 'hidden lg:block')}>
        {view === 'json' ? (
          <MetricJsonPreview />
        ) : (
          <div className="space-y-3">
            <p className="font-medium text-foreground text-sm">{name || 'Untitled metric'}</p>
            <DefinitionSummary definition={toMetricDefinition(values)} />
          </div>
        )}
      </div>
    </Surface>
  );
}

function ToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded px-2.5 font-medium text-xs',
        active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
