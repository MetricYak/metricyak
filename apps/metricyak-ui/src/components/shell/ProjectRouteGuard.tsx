import { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { listOrganizations } from '@/api/organizations';
import { listProjects } from '@/api/projects';
import { PageContainer } from '@/components/shell/PageContainer';
import { ProjectSwitcher } from '@/components/sidebar/ProjectSwitcher';
import { useProjectContext } from '@/contexts/ProjectContext';

type GuardState = 'checking' | 'ready' | 'not-found';

export function ProjectRouteGuard(): React.JSX.Element {
  const { projectId } = useParams<{ projectId: string }>();
  const { activeProject, setActiveProject } = useProjectContext();
  const [state, setState] = useState<GuardState>('checking');

  useEffect(() => {
    if (!projectId) return;
    if (activeProject?.id === projectId) {
      setState('ready');
      return;
    }

    let cancelled = false;
    setState('checking');

    listOrganizations()
      .then(async (orgs) => {
        for (const org of orgs) {
          const projects = await listProjects(org.id);
          const match = projects.find((project) => project.id === projectId);
          if (match) return { project: match, org };
        }
        return null;
      })
      .then((found) => {
        if (cancelled) return;
        if (!found) {
          setState('not-found');
          return;
        }
        setActiveProject(found.project, found.org);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('not-found');
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, activeProject, setActiveProject]);

  if (state === 'checking') return <div className="h-full" />;

  if (state === 'not-found') {
    return (
      <PageContainer width="content" className="py-16">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="font-semibold text-foreground text-sm">That project isn't here</p>
          <p className="max-w-sm text-muted-foreground text-sm">
            The link points at a project you can't open. Pick one you can.
          </p>
          <div className="w-64">
            <ProjectSwitcher collapsed={false} />
          </div>
        </div>
      </PageContainer>
    );
  }

  return <Outlet />;
}
