import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

export function MetricDefinitionDetailPage(): React.JSX.Element {
  const { metricId } = useParams<{ metricId: string }>();

  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-6 py-16 text-center md:px-8">
      <Link
        to="/metrics/definitions"
        className="mb-4 inline-flex items-center gap-1.5 self-start text-muted-foreground text-sm hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to definitions
      </Link>
      <h1 className="font-semibold text-foreground text-lg">Metric details are coming soon</h1>
      <p className="max-w-sm text-muted-foreground text-sm">
        This page will show everything wired to metric {metricId} — including the monitors watching
        it.
      </p>
    </div>
  );
}
