import { Navigate, useParams } from 'react-router-dom';
import { useProjectRoute } from '@/hooks/useProjectRoute';

export function MetricDefinitionDetailPage(): React.JSX.Element {
  const { metricId } = useParams<{ metricId: string }>();
  const { to } = useProjectRoute();
  const destination = metricId
    ? to(`/metrics/definitions?m=${encodeURIComponent(metricId)}`)
    : to('/metrics/definitions');
  return <Navigate to={destination} replace />;
}
