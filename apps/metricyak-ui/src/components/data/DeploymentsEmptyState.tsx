import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DeploymentsEmptyStateProps {
  onConnect: () => void;
}

export function DeploymentsEmptyState({
  onConnect,
}: DeploymentsEmptyStateProps): React.JSX.Element {
  return (
    <div className="rounded-lg border-2 border-border border-dashed px-6 py-16">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <h2 className="text-balance font-semibold text-xl">Connect your first deployment source</h2>
        <p className="mt-2 text-pretty text-muted-foreground text-sm leading-relaxed">
          We save every deploy as an event and mark it on this project’s metric charts, so a jump or
          dip always has a story next to it.
        </p>
        <Button variant="raised" className="mt-6" onClick={onConnect}>
          <Plus className="size-4" />
          Connect a source
        </Button>
      </div>
    </div>
  );
}
