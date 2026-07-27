import { Navigate, useParams } from 'react-router-dom';
import { useProjectRoute } from '@/hooks/useProjectRoute';

export function MetricDefinitionDetailPage(): React.JSX.Element {
  const { metricId } = useParams<{ metricId: string }>();
  const { to } = useProjectRoute();
  const destination = metricId
    ? to(`/metrics/catalogue?m=${encodeURIComponent(metricId)}`)
    : to('/metrics/catalogue');
  return <Navigate to={destination} replace />;
}
