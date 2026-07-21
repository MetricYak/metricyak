import { ArrowUpRight, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Surface } from '@/components/ui/surface';

export function FirstEventCallout(): React.JSX.Element {
  return (
    <Surface className="flex items-start gap-3">
      <Radio className="mt-0.5 size-4 shrink-0 text-metricyak-brand-orange" />
      <div className="min-w-0 space-y-1">
        <p className="font-medium text-foreground text-sm">No events have arrived yet</p>
        <p className="text-muted-foreground text-sm">
          A metric counts events your app sends. You can still name one below and it'll start
          filling in once events flow — or send your first event first.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
          <Link
            to="/settings/project/keys"
            className="inline-flex items-center gap-1 font-medium text-brand-orange-text text-sm hover:underline"
          >
            Get an API key
            <ArrowUpRight className="size-3.5" />
          </Link>
          <Link
            to="/activity/live"
            className="inline-flex items-center gap-1 font-medium text-brand-orange-text text-sm hover:underline"
          >
            Watch the live feed
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </Surface>
  );
}
