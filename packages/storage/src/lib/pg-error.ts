export const PG_CODES = {
  uniqueViolation: '23505',
  undefinedTable: '42P01',
} as const;

const MAX_CAUSE_DEPTH = 10;

const SQLSTATE = /^[0-9A-Z]{5}$/;

export function pgErrorCode(error: unknown, depth = 0): string | null {
  if (depth > MAX_CAUSE_DEPTH || typeof error !== 'object' || error === null) return null;
  if ('code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && SQLSTATE.test(code)) return code;
  }
  if ('cause' in error) {
    return pgErrorCode((error as { cause?: unknown }).cause, depth + 1);
  }
  return null;
}
