import { BellPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function MonitorComingSoon({ metricName }: { metricName: string }): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border border-dashed p-5">
      <div className="flex items-center gap-2">
        <BellPlus className="size-4 shrink-0 text-muted-foreground" />
        <h3 className="font-semibold text-foreground text-sm">Monitor this metric</h3>
        <Badge variant="secondary">Coming soon</Badge>
      </div>
      <p className="mt-1 max-w-md text-muted-foreground text-sm">
        Soon you'll be told when {metricName} crosses a threshold — routed to Slack, email, or a
        workflow.
      </p>
    </section>
  );
}
