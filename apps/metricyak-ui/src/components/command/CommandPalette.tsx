import { Command as Cmdk } from 'cmdk';
import {
  Activity,
  BarChart3,
  BellRing,
  KeyRound,
  type LucideIcon,
  Plus,
  SearchIcon,
  SearchX,
  Settings,
  SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

interface PaletteAction {
  id: string;
  label: string;
  hint: string;
  keywords?: string;
  icon: LucideIcon;
  iconColor: string;
  to: string;
  badge?: string;
}

const ACTIONS: readonly PaletteAction[] = [
  {
    id: 'new-metric',
    label: 'Create metric',
    hint: 'New definition',
    keywords: 'add define event',
    icon: Plus,
    iconColor: 'text-metricyak-brand-orange',
    to: '/metrics/definitions/new',
  },
];

const NAVIGATE: readonly PaletteAction[] = [
  {
    id: 'activity',
    label: 'Activity',
    hint: 'Live event stream',
    keywords: 'events feed',
    icon: Activity,
    iconColor: 'text-emerald-600',
    to: '/activity/live',
  },
  {
    id: 'metrics',
    label: 'Metrics',
    hint: 'Definitions',
    keywords: 'measures',
    icon: BarChart3,
    iconColor: 'text-blue-600',
    to: '/metrics/definitions',
  },
  {
    id: 'monitors',
    label: 'Monitors',
    hint: 'Alerts & thresholds',
    keywords: 'notify',
    icon: BellRing,
    iconColor: 'text-amber-600',
    to: '/monitors',
    badge: 'Coming soon',
  },
  {
    id: 'settings',
    label: 'Settings',
    hint: 'Project',
    keywords: 'preferences',
    icon: Settings,
    iconColor: 'text-slate-500',
    to: '/settings/project/general',
  },
  {
    id: 'settings-general',
    label: 'Project settings',
    hint: 'General',
    keywords: 'name',
    icon: SlidersHorizontal,
    iconColor: 'text-slate-500',
    to: '/settings/project/general',
  },
  {
    id: 'settings-keys',
    label: 'API keys',
    hint: 'Settings',
    keywords: 'tokens secret sdk',
    icon: KeyRound,
    iconColor: 'text-violet-600',
    to: '/settings/project/keys',
  },
];

const GROUP_HEADING =
  '[&_[cmdk-group-heading]]:-mx-1 [&_[cmdk-group-heading]]:mb-1 [&_[cmdk-group-heading]]:border-border [&_[cmdk-group-heading]]:border-y [&_[cmdk-group-heading]]:bg-muted [&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground';

export function CommandPalette(): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
    if (!open) setSearch('');
  }, [open]);

  const run = (to: string): void => {
    setOpen(false);
    navigate(to);
  };

  const renderItem = (action: PaletteAction): React.JSX.Element => (
    <CommandItem
      key={action.id}
      value={`${action.label} ${action.hint} ${action.keywords ?? ''}`}
      onSelect={() => run(action.to)}
      className="gap-2.5 rounded-md px-3 py-1.5 data-[selected=true]:bg-primary/12! data-[selected=true]:text-foreground"
    >
      <action.icon className={`size-4 ${action.iconColor}`} />
      <span className="font-medium text-foreground">{action.label}</span>
      <span className="text-muted-foreground text-xs">{action.hint}</span>
      {action.badge ? (
        <Badge variant="secondary" className="ml-1 font-normal">
          {action.badge}
        </Badge>
      ) : null}
    </CommandItem>
  );

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: onClick only detects backdrop clicks; Esc is handled natively by the dialog's onCancel.
    <dialog
      ref={ref}
      aria-label="Command menu"
      className="command-palette dialog w-[calc(100vw-2rem)] max-w-2xl p-0 backdrop:backdrop-blur-[2px]"
      onCancel={(e) => {
        e.preventDefault();
        setOpen(false);
      }}
      onClick={(e) => {
        if (e.target === ref.current) setOpen(false);
      }}
    >
      {open ? (
        <Command loop className="flex max-h-[inherit] flex-col">
          <div className="border-border border-b p-3">
            <div className="flex h-11 items-center gap-2.5 rounded-lg border border-input bg-background px-3 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
              <Cmdk.Input
                autoFocus
                value={search}
                onValueChange={setSearch}
                placeholder="Search actions and pages…"
                className="h-full w-full bg-transparent text-[15px] outline-hidden placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <CommandList className="max-h-none flex-1 px-0 pt-0 pb-1.5">
            <CommandEmpty className="px-6 py-12 text-center">
              <SearchX className="mx-auto size-6 text-muted-foreground/50" />
              <p className="mt-3 text-foreground text-sm">
                No trail for “<span className="break-all font-medium">{search}</span>”
              </p>
              <p className="mt-1 text-muted-foreground text-sm">
                This yak sniffed around and came up empty — try another search.
              </p>
            </CommandEmpty>
            <CommandGroup
              heading="Actions"
              className={`${GROUP_HEADING} pt-0 [&_[cmdk-group-heading]]:border-t-0`}
            >
              {ACTIONS.map(renderItem)}
            </CommandGroup>
            <CommandGroup heading="Go to" className={GROUP_HEADING}>
              {NAVIGATE.map(renderItem)}
            </CommandGroup>
          </CommandList>

          <div className="flex items-center gap-4 border-border border-t bg-muted px-3 py-2.5 text-muted-foreground text-xs shadow-[0_-4px_12px_-8px_rgb(0_0_0/0.14)]">
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              navigate
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd>
              select
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>Esc</Kbd>
              close
            </span>
          </div>
        </Command>
      ) : null}
    </dialog>
  );
}

function Kbd({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <kbd className="inline-flex min-w-5 items-center justify-center rounded border border-border bg-background px-1.5 py-0.5 font-medium font-sans text-[10px] text-muted-foreground shadow-xs">
      {children}
    </kbd>
  );
}
