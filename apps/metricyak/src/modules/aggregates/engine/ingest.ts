const FIELD_PREFIX = '$properties.';

export function fieldPath(field: string): string[] {
  const path = field.startsWith(FIELD_PREFIX) ? field.slice(FIELD_PREFIX.length) : field;
  return path.split('.');
}
