import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  UserPlus,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { listOrganizations, type Organization } from '@/api/organizations';
import { createProject, listProjects, type Project } from '@/api/projects';
import { useProjectContext } from '@/contexts/ProjectContext';
import { cn } from '@/lib/utils';

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

interface PopupRect {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

// Popup never exceeds the shorter of a comfortable ceiling or the space below
// the trigger, so a long project list scrolls internally instead of stretching
// the popup past the viewport.
const POPUP_MAX_HEIGHT = 480;
const POPUP_MIN_HEIGHT = 240;
const POPUP_VIEWPORT_GUTTER = 16;

function computePopupRect(trigger: HTMLElement): PopupRect {
  const rect = trigger.getBoundingClientRect();
  const available = window.innerHeight - rect.bottom - POPUP_VIEWPORT_GUTTER;
  return {
    top: rect.bottom + 4,
    left: rect.left,
    width: Math.min(Math.max(rect.width, 272), 320),
    maxHeight: Math.min(POPUP_MAX_HEIGHT, Math.max(available, POPUP_MIN_HEIGHT)),
  };
}

interface MenuRect {
  top: number;
  left: number;
}

const ROW_MENU_WIDTH = 184;
const ROW_MENU_GUTTER = 8;

function computeRowMenuRect(trigger: HTMLElement): MenuRect {
  const rect = trigger.getBoundingClientRect();
  return {
    top: rect.bottom + 4,
    left: Math.min(
      Math.max(rect.right - ROW_MENU_WIDTH, ROW_MENU_GUTTER),
      window.innerWidth - ROW_MENU_WIDTH - ROW_MENU_GUTTER,
    ),
  };
}

type View = 'home' | 'browse' | 'create';

// ─── Shared primitives ────────────────────────────────────────────────────────

function SkeletonRow({ className }: { className?: string }): React.JSX.Element {
  return <div className={cn('h-7 animate-pulse rounded-md bg-sidebar-accent', className)} />;
}

// ─── Project row actions menu ───────────────────────────────────────────────

function ProjectRowMenu({
  project,
  rect,
  menuRef,
  onClose,
  onOpenSettings,
}: {
  project: Project;
  rect: MenuRect;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onOpenSettings: (project: Project) => void;
}): React.JSX.Element {
  useEffect(() => {
    const onMouseDown = (e: MouseEvent): void => {
      if (!menuRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuRef, onClose]);

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.97, y: -2 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: -2 }}
      transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
      role="menu"
      aria-label={`${project.name} actions`}
      style={{
        position: 'fixed',
        top: rect.top,
        left: rect.left,
        width: ROW_MENU_WIDTH,
      }}
      className="z-(--z-popover) flex flex-col gap-0.5 overflow-hidden rounded-lg border border-sidebar-border bg-popover p-1 shadow-xl"
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => onOpenSettings(project)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-sidebar-accent"
      >
        <Settings className="size-3.5 shrink-0 text-muted-foreground" />
        Project settings
      </button>
      <button
        type="button"
        role="menuitem"
        disabled
        title="Coming soon"
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UserPlus className="size-3.5 shrink-0" />
        Invite members
      </button>
    </motion.div>
  );
}

function SectionHeader({
  label,
  addLabel,
  addDisabled,
  onAdd,
}: {
  label: string;
  addLabel: string;
  addDisabled?: boolean;
  onAdd?: () => void;
}): React.JSX.Element {
  return (
    <>
      <div className="flex shrink-0 items-center justify-between px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <button
          type="button"
          onClick={onAdd}
          disabled={addDisabled}
          title={addDisabled ? 'Coming soon' : addLabel}
          aria-label={addLabel}
          className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      {/* Full-width rule — no horizontal padding so it goes edge-to-edge */}
      <div className="shrink-0 border-b border-sidebar-border" />
    </>
  );
}

// ─── Home view ────────────────────────────────────────────────────────────────

function HomeContent({
  activeOrgName,
  activeProjectName,
  orgs,
  orgsLoading,
  orgsError,
  popupOrgId,
  onOpenBrowse,
  onSelectOrg,
}: {
  activeOrgName: string | undefined;
  activeProjectName: string | undefined;
  orgs: Organization[];
  orgsLoading: boolean;
  orgsError: string | null;
  popupOrgId: string | null;
  onOpenBrowse: () => void;
  onSelectOrg: (org: Organization) => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col">
      {/* ── Active project — the current selection, opens the full browser ─── */}
      <div className="p-2">
        <button
          type="button"
          onClick={onOpenBrowse}
          aria-label="Browse all projects"
          className="group flex w-full items-center gap-2.5 rounded-md border border-metricyak-brand-orange/40 bg-metricyak-brand-orange/10 px-2.5 py-2 text-left transition-colors hover:bg-metricyak-brand-orange/15"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[10px] leading-tight text-muted-foreground">
              {activeOrgName ?? 'No organization'}
            </span>
            <span className="block truncate text-sm font-semibold leading-snug">
              {activeProjectName ?? (
                <span className="font-normal text-muted-foreground">Select a project</span>
              )}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-metricyak-brand-orange transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* ── Organizations — secondary, compact ──────────────────── */}
      <div className="shrink-0 border-t border-sidebar-border">
        <SectionHeader label="Organizations" addLabel="Add organization" addDisabled />

        <div className="scroll-shadows max-h-28 overflow-y-auto px-1 py-1 pb-1.5">
          {orgsLoading ? (
            <div className="space-y-1 p-1">
              <SkeletonRow className="h-6" />
              <SkeletonRow className="h-6" />
            </div>
          ) : orgsError ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">{orgsError}</p>
          ) : (
            orgs.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => onSelectOrg(org)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-sidebar-accent',
                  org.id === popupOrgId && 'font-medium',
                )}
              >
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    org.id === popupOrgId ? 'bg-metricyak-brand-orange' : 'bg-metricyak-400',
                  )}
                />
                <span className="flex-1 truncate">{org.name}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Browse view ──────────────────────────────────────────────────────────────

function BrowseContent({
  orgName,
  popupProjects,
  projectsLoading,
  projectsError,
  activeProjectId,
  openMenuProjectId,
  onSelectProject,
  onNewProject,
  onRetry,
  onToggleProjectMenu,
  onBack,
}: {
  orgName: string | undefined;
  popupProjects: Project[];
  projectsLoading: boolean;
  projectsError: string | null;
  activeProjectId: string | undefined;
  openMenuProjectId: string | null;
  onSelectProject: (project: Project) => void;
  onNewProject: () => void;
  onRetry: () => void;
  onToggleProjectMenu: (project: Project, trigger: HTMLButtonElement) => void;
  onBack: () => void;
}): React.JSX.Element {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => searchRef.current?.focus(), 150);
    return () => clearTimeout(id);
  }, []);

  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? popupProjects.filter((p) => p.name.toLowerCase().includes(trimmed))
    : popupProjects;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1.5 px-2 py-1.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[10px] leading-tight text-muted-foreground">
            {orgName ?? 'No organization'}
          </span>
          <span className="block truncate text-sm font-medium leading-snug">All projects</span>
        </span>
        <button
          type="button"
          onClick={onNewProject}
          aria-label="New project"
          title="New project"
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <Plus className="size-4" />
        </button>
      </div>
      <div className="shrink-0 border-b border-sidebar-border" />

      <div className="shrink-0 px-2 pt-1.5">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
            aria-label="Search projects"
            className="w-full rounded-md border border-input bg-transparent py-1 pl-7 pr-2 text-sm placeholder:text-muted-foreground focus:border-metricyak-brand-orange focus:outline-none"
          />
        </div>
      </div>

      <div
        className="scroll-shadows mt-1 min-h-0 flex-1 overflow-y-auto px-1 py-1"
        role="listbox"
        aria-label="Projects"
      >
        {projectsLoading ? (
          <div className="space-y-1 p-1">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : projectsError ? (
          <div className="px-2 py-3 text-center">
            <p className="mb-1.5 text-sm text-muted-foreground">{projectsError}</p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md px-3 py-1 text-sm font-medium text-metricyak-brand-orange transition-colors hover:bg-sidebar-accent"
            >
              Try again
            </button>
          </div>
        ) : popupProjects.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">No projects yet.</p>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">
            No projects match “{query.trim()}”.
          </p>
        ) : (
          filtered.map((project) => (
            <div
              key={project.id}
              className={cn(
                'group relative flex items-center rounded-md transition-colors hover:bg-sidebar-accent',
                openMenuProjectId === project.id && 'bg-sidebar-accent',
              )}
            >
              <button
                type="button"
                role="option"
                aria-selected={project.id === activeProjectId}
                onClick={() => onSelectProject(project)}
                className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm"
              >
                <Check
                  className={cn(
                    'size-3.5 shrink-0',
                    project.id === activeProjectId ? 'text-metricyak-brand-orange' : 'invisible',
                  )}
                />
                <span className="flex-1 truncate">{project.name}</span>
              </button>
              <button
                type="button"
                onClick={(e) => onToggleProjectMenu(project, e.currentTarget)}
                aria-label={`Actions for ${project.name}`}
                aria-haspopup="menu"
                aria-expanded={openMenuProjectId === project.id}
                className={cn(
                  'mr-1 shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity',
                  'hover:bg-sidebar-border hover:text-sidebar-foreground',
                  'group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100',
                  openMenuProjectId === project.id && 'opacity-100',
                )}
              >
                <MoreHorizontal className="size-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Create view ─────────────────────────────────────────────────────────────

function CreateContent({
  inputRef,
  orgName,
  name,
  creating,
  error,
  onChange,
  onBack,
  onCreate,
  onCancel,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  orgName: string | undefined;
  name: string;
  creating: boolean;
  error: string | null;
  onChange: (v: string) => void;
  onBack: () => void;
  onCreate: () => void;
  onCancel: () => void;
}): React.JSX.Element {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && name.trim() && !creating) onCreate();
  };

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to project list"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium">New project</span>
        {orgName && (
          <span className="ml-auto truncate text-[10px] text-muted-foreground">{orgName}</span>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="project-name" className="text-xs font-medium text-foreground">
          Project name
        </label>
        <input
          ref={inputRef}
          id="project-name"
          type="text"
          value={name}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. iOS App"
          maxLength={128}
          disabled={creating}
          autoComplete="off"
          className={cn(
            'w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm',
            'placeholder:text-muted-foreground',
            'focus:border-metricyak-brand-orange focus:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive',
          )}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCreate}
          disabled={!name.trim() || creating}
          className={cn(
            'raised flex flex-1 items-center justify-center gap-1.5 rounded-md',
            'bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {creating && <Loader2 className="size-3.5 animate-spin" />}
          {creating ? 'Creating…' : 'Create project'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={creating}
          className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ProjectSwitcherProps {
  collapsed: boolean;
}

export function ProjectSwitcher({ collapsed }: ProjectSwitcherProps): React.JSX.Element {
  const { activeOrg, activeProject, setActiveProject } = useProjectContext();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  // Views slide horizontally in the direction of travel: forward when
  // drilling in (home → browse → create), backward when backing out.
  const slideVariants = {
    enter: (direction: 1 | -1) => ({ opacity: 0, x: shouldReduceMotion ? 0 : direction * 12 }),
    center: { opacity: 1, x: 0 },
    exit: (direction: 1 | -1) => ({ opacity: 0, x: shouldReduceMotion ? 0 : direction * -12 }),
  };

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('home');
  const [navDirection, setNavDirection] = useState<1 | -1>(1);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [popupRect, setPopupRect] = useState<PopupRect>({
    top: 0,
    left: 0,
    width: 272,
    maxHeight: POPUP_MAX_HEIGHT,
  });

  // Per-row actions menu (project settings, invite members)
  const [rowMenu, setRowMenu] = useState<{ project: Project; rect: MenuRect } | null>(null);
  const rowMenuElRef = useRef<HTMLDivElement>(null);

  // Org list
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgsError, setOrgsError] = useState<string | null>(null);

  // Org currently viewed in the popup — stored as the full object (not just an
  // id looked up in `orgs`) so selection doesn't race with the async org list load.
  const [popupOrg, setPopupOrg] = useState<Organization | null>(null);
  const popupOrgId = popupOrg?.id ?? null;
  const [popupProjects, setPopupProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const loadIdRef = useRef(0);

  const close = useCallback((): void => {
    setOpen(false);
    setView('home');
    setNewName('');
    setCreateError(null);
    setRowMenu(null);
  }, []);

  const loadOrgs = useCallback(async (): Promise<Organization[]> => {
    setOrgsLoading(true);
    setOrgsError(null);
    try {
      const result = await listOrganizations();
      setOrgs(result);
      return result;
    } catch {
      setOrgsError('Could not load organizations.');
      return [];
    } finally {
      setOrgsLoading(false);
    }
  }, []);

  const loadProjects = useCallback(async (orgId: string): Promise<void> => {
    const id = ++loadIdRef.current;
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const result = await listProjects(orgId);
      if (id !== loadIdRef.current) return;
      setPopupProjects(result);
    } catch {
      if (id !== loadIdRef.current) return;
      setProjectsError('Could not load projects.');
    } finally {
      if (id === loadIdRef.current) setProjectsLoading(false);
    }
  }, []);

  const openPopup = async (): Promise<void> => {
    if (!triggerRef.current) return;
    setPopupRect(computePopupRect(triggerRef.current));
    setPopupOrg(activeOrg ?? null);
    setView('home');
    setOpen(true);
    if (activeOrg) {
      void loadOrgs();
      void loadProjects(activeOrg.id);
      return;
    }
    // No active org yet (fresh blank-slate case) — once the org list loads,
    // default the popup to the first org so "Browse all projects" → "New
    // project" works without requiring a manual org click first.
    const loadedOrgs = await loadOrgs();
    const first = loadedOrgs[0];
    if (first) {
      setPopupOrg(first);
      void loadProjects(first.id);
    }
  };

  // Click-outside and Escape
  useEffect(() => {
    if (!open) return;

    const onMouseDown = (e: MouseEvent): void => {
      const target = e.target as Node;
      if (
        !popupRef.current?.contains(target) &&
        !triggerRef.current?.contains(target) &&
        !rowMenuElRef.current?.contains(target)
      ) {
        close();
      }
    };

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };

    // Keep the popup anchored and correctly capped as the viewport changes.
    const reposition = (): void => {
      if (triggerRef.current) setPopupRect(computePopupRect(triggerRef.current));
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, close]);

  // Focus input when create view opens
  useEffect(() => {
    if (view !== 'create') return;
    const id = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(id);
  }, [view]);

  const handleSelectProject = (project: Project): void => {
    if (popupOrg) setActiveProject(project, popupOrg);
    close();
  };

  const handleSelectOrg = (org: Organization): void => {
    setPopupOrg(org);
    setPopupProjects([]);
    void loadProjects(org.id);
  };

  const openBrowse = (): void => {
    setNavDirection(1);
    setView('browse');
  };

  const backToHome = (): void => {
    setNavDirection(-1);
    setView('home');
  };

  const goCreate = (): void => {
    setNavDirection(1);
    setView('create');
  };

  const backFromCreate = (): void => {
    setNavDirection(-1);
    setView('browse');
  };

  const handleToggleProjectMenu = (project: Project, trigger: HTMLButtonElement): void => {
    setRowMenu((prev) =>
      prev?.project.id === project.id ? null : { project, rect: computeRowMenuRect(trigger) },
    );
  };

  const handleOpenProjectSettings = (project: Project): void => {
    if (popupOrg) setActiveProject(project, popupOrg);
    close();
    navigate('/settings');
  };

  const handleCreate = async (): Promise<void> => {
    if (!newName.trim() || !popupOrg) return;
    setCreating(true);
    setCreateError(null);
    try {
      const project = await createProject(popupOrg.id, newName.trim());
      setPopupProjects((prev) => [...prev, project]);
      setActiveProject(project, popupOrg);
      close();
    } catch {
      setCreateError('Failed to create project. Try again.');
    } finally {
      setCreating(false);
    }
  };

  const initials = activeProject ? getInitials(activeProject.name) : 'MY';
  const creatingOrgName = popupOrg?.name;

  return (
    <>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (open) close();
          else void openPopup();
        }}
        aria-label="Switch project"
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors',
          'hover:bg-sidebar-accent',
          open && 'bg-sidebar-accent',
          collapsed && 'justify-center px-1 py-1.5',
        )}
      >
        {/* Initials chip */}
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-md',
            'bg-metricyak-300 font-semibold text-sidebar-foreground',
            collapsed ? 'size-9 text-sm' : 'size-7 text-xs',
          )}
        >
          {initials}
        </span>

        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] leading-tight text-muted-foreground">
                {activeOrg?.name ?? 'No organization'}
              </span>
              <span className="block truncate text-sm font-medium leading-snug">
                {activeProject?.name ?? (
                  <span className="font-normal text-muted-foreground">Select a project</span>
                )}
              </span>
            </span>
            <ChevronDown
              className={cn(
                'size-3.5 shrink-0 text-muted-foreground transition-transform duration-150',
                open && 'rotate-180',
              )}
            />
          </>
        )}
      </button>

      {/* Popup — portal to escape sidebar overflow:hidden */}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={popupRef}
              initial={{ opacity: 0, scale: 0.97, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -4 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              role="dialog"
              aria-label="Project switcher"
              style={{
                position: 'fixed',
                top: popupRect.top,
                left: popupRect.left,
                width: popupRect.width,
                maxHeight: popupRect.maxHeight,
              }}
              className="z-(--z-dropdown) flex flex-col overflow-hidden rounded-lg border border-sidebar-border bg-popover shadow-xl"
            >
              <AnimatePresence mode="wait" initial={false} custom={navDirection}>
                <motion.div
                  key={view}
                  custom={navDirection}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  {view === 'home' ? (
                    <HomeContent
                      activeOrgName={activeOrg?.name}
                      activeProjectName={activeProject?.name}
                      orgs={orgs}
                      orgsLoading={orgsLoading}
                      orgsError={orgsError}
                      popupOrgId={popupOrgId}
                      onOpenBrowse={openBrowse}
                      onSelectOrg={handleSelectOrg}
                    />
                  ) : view === 'browse' ? (
                    <BrowseContent
                      orgName={creatingOrgName}
                      popupProjects={popupProjects}
                      projectsLoading={projectsLoading}
                      projectsError={projectsError}
                      activeProjectId={activeProject?.id}
                      openMenuProjectId={rowMenu?.project.id ?? null}
                      onSelectProject={handleSelectProject}
                      onNewProject={goCreate}
                      onRetry={() => {
                        if (popupOrgId) void loadProjects(popupOrgId);
                      }}
                      onToggleProjectMenu={handleToggleProjectMenu}
                      onBack={backToHome}
                    />
                  ) : (
                    <CreateContent
                      inputRef={inputRef}
                      orgName={creatingOrgName}
                      name={newName}
                      creating={creating}
                      error={createError}
                      onChange={setNewName}
                      onBack={backFromCreate}
                      onCreate={() => void handleCreate()}
                      onCancel={close}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* Row actions menu — separate portal so it can layer above the popup */}
      {createPortal(
        <AnimatePresence>
          {rowMenu && (
            <ProjectRowMenu
              key={rowMenu.project.id}
              project={rowMenu.project}
              rect={rowMenu.rect}
              menuRef={rowMenuElRef}
              onClose={() => setRowMenu(null)}
              onOpenSettings={handleOpenProjectSettings}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
