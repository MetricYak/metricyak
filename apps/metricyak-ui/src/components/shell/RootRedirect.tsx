import { Navigate } from 'react-router-dom';
import { OnboardingPage } from '@/components/onboarding/OnboardingPage';
import { useProjectContext } from '@/contexts/ProjectContext';
import { projectPath } from '@/lib/project-path';

export function RootRedirect(): React.JSX.Element {
  const { status, activeProject } = useProjectContext();

  if (status === 'loading') return <div className="h-dvh w-screen" />;
  if (status === 'needs-onboarding' || !activeProject) return <OnboardingPage />;

  return <Navigate to={projectPath(activeProject.id, '/metrics/explore')} replace />;
}
