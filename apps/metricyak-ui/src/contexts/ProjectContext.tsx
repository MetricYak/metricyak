import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { listOrganizations, type Organization } from '@/api/organizations';
import { listProjects, type Project } from '@/api/projects';

export type BootstrapStatus = 'loading' | 'needs-onboarding' | 'ready' | 'error';

type ProjectContextValue = {
  status: BootstrapStatus;
  activeOrg: Organization | null;
  activeProject: Project | null;
  setActiveProject: (project: Project, org: Organization) => void;
  updateActiveProject: (project: Project) => void;
  refresh: () => void;
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
  const [status, setStatus] = useState<BootstrapStatus>('loading');
  const [nonce, setNonce] = useState(0);
  const [activeOrg, setActiveOrgState] = useState<Organization | null>(() =>
    readStorage<Organization>('metricyak.active-org'),
  );
  const [activeProject, setActiveProjectState] = useState<Project | null>(() =>
    readStorage<Project>('metricyak.active-project'),
  );
  const activeProjectRef = useRef(activeProject);
  activeProjectRef.current = activeProject;

  const setActiveProject = useCallback((project: Project, org: Organization): void => {
    setActiveProjectState(project);
    setActiveOrgState(org);
    writeStorage('metricyak.active-project', project);
    writeStorage('metricyak.active-org', org);
    setStatus('ready');
  }, []);

  const updateActiveProject = useCallback((project: Project): void => {
    setActiveProjectState((current) => {
      if (current?.id !== project.id) return current;
      writeStorage('metricyak.active-project', project);
      return project;
    });
  }, []);

  const refresh = useCallback((): void => {
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    listOrganizations()
      .then(async (orgs) => {
        if (cancelled) return;
        const org = orgs[0];
        if (!org) {
          setStatus('needs-onboarding');
          return;
        }
        const projects = await listProjects(org.id);
        if (cancelled) return;
        const project = projects[0];
        if (project && !activeProjectRef.current) {
          setActiveProject(project, org);
        }
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [setActiveProject, nonce]);

  return (
    <ProjectContext.Provider
      value={{ status, activeOrg, activeProject, setActiveProject, updateActiveProject, refresh }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjectContext must be used within ProjectProvider');
  return ctx;
}
