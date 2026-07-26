import { Navigate, useParams } from 'react-router-dom';
import { useProjectRoute } from '@/hooks/useProjectRoute';

export function LegacyMetricRedirect(): React.JSX.Element {
  const { metricId } = useParams<{ metricId: string }>();
  const { to } = useProjectRoute();
  return <Navigate to={to(`/metrics/catalogue/${metricId ?? ''}`)} replace />;
}
