export interface BucketCursor {
  readonly anchor: number;
  readonly cursor: number;
}

export interface CursorMove {
  readonly key: string;
  readonly extend: boolean;
  readonly lastIndex: number;
}

const PAGE_STEP = 10;

function clamp(value: number, lastIndex: number): number {
  return Math.min(lastIndex, Math.max(0, value));
}

function movedCursor(cursor: number, key: string, lastIndex: number): number | null {
  switch (key) {
    case 'ArrowLeft':
      return clamp(cursor - 1, lastIndex);
    case 'ArrowRight':
      return clamp(cursor + 1, lastIndex);
    case 'PageUp':
      return clamp(cursor - PAGE_STEP, lastIndex);
    case 'PageDown':
      return clamp(cursor + PAGE_STEP, lastIndex);
    case 'Home':
      return 0;
    case 'End':
      return lastIndex;
    default:
      return null;
  }
}

export function nextBucketCursor(current: BucketCursor, move: CursorMove): BucketCursor | null {
  if (move.lastIndex < 0) return null;
  const cursor = movedCursor(clamp(current.cursor, move.lastIndex), move.key, move.lastIndex);
  if (cursor === null) return null;
  return { anchor: move.extend ? clamp(current.anchor, move.lastIndex) : cursor, cursor };
}

export function cursorBounds(cursor: BucketCursor): { start: number; end: number } {
  return cursor.anchor <= cursor.cursor
    ? { start: cursor.anchor, end: cursor.cursor }
    : { start: cursor.cursor, end: cursor.anchor };
}
