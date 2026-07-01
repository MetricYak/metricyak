import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { listOrganizations, type Organization } from '@/api/organizations';
import { listProjects, type Project } from '@/api/projects';

type ProjectContextValue = {
  activeOrg: Organization | null;
  activeProject: Project | null;
  setActiveProject: (project: Project, org: Organization) => void;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

function readStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable
  }
}

export function ProjectProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [activeOrg, setActiveOrgState] = useState<Organization | null>(() =>
    readStorage<Organization>('metricyak.active-org'),
  );
  const [activeProject, setActiveProjectState] = useState<Project | null>(() =>
    readStorage<Project>('metricyak.active-project'),
  );

  const setActiveProject = useCallback((project: Project, org: Organization): void => {
    setActiveProjectState(project);
    setActiveOrgState(org);
    writeStorage('metricyak.active-project', project);
    writeStorage('metricyak.active-org', org);
  }, []);

  useEffect(() => {
    if (activeProject) return;

    listOrganizations()
      .then(async (orgs) => {
        const org = orgs[0];
        if (!org) return;
        const projects = await listProjects(org.id);
        const project = projects[0];
        if (!project) return;
        setActiveProject(project, org);
      })
      .catch(() => {
        // Backend not running yet — silently skip
      });
  }, [activeProject, setActiveProject]);

  return (
    <ProjectContext.Provider value={{ activeOrg, activeProject, setActiveProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjectContext must be used within ProjectProvider');
  return ctx;
}
