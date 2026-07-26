const DEFAULT_SECTION_ROOT = '/metrics/explore';

export function projectPath(projectId: string, suffix: string): string {
  if (suffix === '') return `/projects/${projectId}`;
  const normalized = suffix.startsWith('/') ? suffix : `/${suffix}`;
  return `/projects/${projectId}${normalized}`;
}

export function sectionRootOf(pathname: string): string {
  const match = pathname.match(/^\/projects\/[^/]+(\/[^/?]+)/);
  return match?.[1] ?? DEFAULT_SECTION_ROOT;
}
