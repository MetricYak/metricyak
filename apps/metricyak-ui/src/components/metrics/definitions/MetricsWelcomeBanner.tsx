import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'metricyak.metrics-welcome-dismissed';

export function isWelcomeBannerDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function dismissWelcomeBanner(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // storage unavailable
  }
}

export function MetricsWelcomeBanner({ onDismiss }: { onDismiss: () => void }): React.JSX.Element {
  const handleDismiss = (): void => {
    dismissWelcomeBanner();
    onDismiss();
  };

  return (
    <div className="relative overflow-hidden rounded-lg border-2 border-border border-dashed px-8 py-10">
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="absolute top-5 right-5 rounded-md p-1 text-muted-foreground hover:bg-metricyak-100 hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      <h2 className="font-semibold text-foreground text-base">Turn events into metrics</h2>
      <p className="mt-2 max-w-md text-muted-foreground text-sm leading-relaxed">
        A metric tells MetricYak which events to watch and how to roll them up — count of signups,
        average order value, whatever moves your business. Monitors and alerts build on top of the
        metrics you define here.
      </p>
      <Button asChild className="raised mt-6">
        <Link to="/metrics/definitions/new">Create your first metric</Link>
      </Button>
    </div>
  );
}
