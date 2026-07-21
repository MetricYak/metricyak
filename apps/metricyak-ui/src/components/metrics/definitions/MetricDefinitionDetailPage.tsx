import { Navigate, useParams } from 'react-router-dom';

export function MetricDefinitionDetailPage(): React.JSX.Element {
  const { metricId } = useParams<{ metricId: string }>();
  const to = metricId
    ? `/metrics/definitions?m=${encodeURIComponent(metricId)}`
    : '/metrics/definitions';
  return <Navigate to={to} replace />;
}
