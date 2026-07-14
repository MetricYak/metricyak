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

// Prefer the previously-selected org if it still exists; otherwise the first one.
// Guards against a stored org that has since been deleted (e.g. a DB reset).
function pickOrg(orgs: Organization[], storedOrgId: string | undefined): Organization | null {
  return orgs.find((o) => o.id === storedOrgId) ?? orgs[0] ?? null;
}

// Keep the stored project only if it still belongs to the chosen org AND still
// exists; otherwise fall back to the org's first project (or none).
function pickProject(
  projects: Project[],
  storedProject: Project | null,
  orgId: string,
): Project | null {
  const storedStillValid =
    !!storedProject &&
    storedProject.organizationId === orgId &&
    projects.some((p) => p.id === storedProject.id);
  return storedStillValid ? storedProject : (projects[0] ?? null);
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
  const activeOrgRef = useRef(activeOrg);
  activeOrgRef.current = activeOrg;

  const setActiveProject = useCallback((project: Project, org: Organization): void => {
    setActiveProjectState(project);
    setActiveOrgState(org);
    writeStorage('metricyak.active-project', project);
    writeStorage('metricyak.active-org', org);
    setStatus('ready');
  }, []);

  const clearActiveSelection = useCallback((): void => {
    setActiveProjectState(null);
    setActiveOrgState(null);
    try {
      localStorage.removeItem('metricyak.active-project');
      localStorage.removeItem('metricyak.active-org');
    } catch {
      // storage unavailable
    }
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: nonce is an intentional refetch trigger for refresh(); it is not read inside the effect body.
  useEffect(() => {
    let cancelled = false;

    listOrganizations()
      .then(async (orgs) => {
        if (cancelled) return;

        // Capture the selection as it was when this pass began, so we can detect
        // a concurrent user switch — the shell (and switcher) is interactive
        // during the 'loading' status, so the user may pick while we fetch.
        const startOrg = activeOrgRef.current;
        const startProject = activeProjectRef.current;

        // Reconcile the stored selection against what actually exists. A stale
        // org/project (e.g. after a DB reset) must never be marked ready, or
        // downstream pages keep querying deleted resources.
        const org = pickOrg(orgs, startOrg?.id);
        if (!org) {
          clearActiveSelection();
          setStatus('needs-onboarding');
          return;
        }

        const projects = await listProjects(org.id);
        if (cancelled) return;

        // The user switched to a different org/project while projects loaded —
        // their choice wins; don't clobber it with this (now outdated) bootstrap
        // pass. Compare by id, not reference: a same-project field refresh
        // (updateActiveProject) swaps the object but isn't a competing choice.
        if (
          activeProjectRef.current?.id !== startProject?.id ||
          activeOrgRef.current?.id !== startOrg?.id
        ) {
          return;
        }

        const chosen = pickProject(projects, startProject, org.id);
        if (!chosen) {
          // Org is valid but has no project yet: keep the org, drop only the
          // stale project so pages don't query a deleted one. The switcher can
          // create the first project against this org.
          setActiveOrgState(org);
          setActiveProjectState(null);
          writeStorage('metricyak.active-org', org);
          try {
            localStorage.removeItem('metricyak.active-project');
          } catch {
            // storage unavailable
          }
          setStatus('ready');
          return;
        }

        // Use the fresh server objects so display fields stay current, and
        // replace the stored selection when it was stale. setActiveProject sets
        // status to 'ready'.
        const freshProject = projects.find((p) => p.id === chosen.id) ?? chosen;
        setActiveProject(freshProject, org);
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [setActiveProject, clearActiveSelection, nonce]);

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
