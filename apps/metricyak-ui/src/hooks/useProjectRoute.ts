import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { projectPath } from '@/lib/project-path';

export function useProjectRoute(): { projectId: string; to: (suffix: string) => string } {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) {
    throw new Error('useProjectRoute must be used inside a /projects/:projectId route');
  }

  const to = useCallback((suffix: string): string => projectPath(projectId, suffix), [projectId]);

  return { projectId, to };
}
