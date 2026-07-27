import { describe, expect, it } from 'vitest';
import {
  type BucketCursor,
  cursorBounds,
  nextBucketCursor,
} from '@/components/metrics/explore/chart-keyboard-selection';

const at = (index: number): BucketCursor => ({ anchor: index, cursor: index });

describe('nextBucketCursor', () => {
  it('moves the whole cursor when the range is not extended', () => {
    expect(nextBucketCursor(at(5), { key: 'ArrowLeft', extend: false, lastIndex: 9 })).toEqual({
      anchor: 4,
      cursor: 4,
    });
  });

  it('keeps the anchor and moves only the cursor when extending', () => {
    expect(nextBucketCursor(at(5), { key: 'ArrowRight', extend: true, lastIndex: 9 })).toEqual({
      anchor: 5,
      cursor: 6,
    });
  });

  it('clamps to the ends of the series', () => {
    expect(nextBucketCursor(at(0), { key: 'ArrowLeft', extend: false, lastIndex: 9 })).toEqual(
      at(0),
    );
    expect(nextBucketCursor(at(9), { key: 'ArrowRight', extend: false, lastIndex: 9 })).toEqual(
      at(9),
    );
  });

  it('jumps ten buckets on PageUp and PageDown', () => {
    expect(nextBucketCursor(at(15), { key: 'PageUp', extend: false, lastIndex: 40 })).toEqual(
      at(5),
    );
    expect(nextBucketCursor(at(15), { key: 'PageDown', extend: false, lastIndex: 40 })).toEqual(
      at(25),
    );
  });

  it('sends Home and End to the series bounds', () => {
    expect(nextBucketCursor(at(4), { key: 'Home', extend: false, lastIndex: 9 })).toEqual(at(0));
    expect(nextBucketCursor(at(4), { key: 'End', extend: false, lastIndex: 9 })).toEqual(at(9));
  });

  it('ignores keys it does not handle', () => {
    expect(nextBucketCursor(at(4), { key: 'a', extend: false, lastIndex: 9 })).toBeNull();
  });

  it('ignores every key when the series is empty', () => {
    expect(nextBucketCursor(at(0), { key: 'ArrowRight', extend: false, lastIndex: -1 })).toBeNull();
  });

  it('pulls a stale cursor back inside a shorter series', () => {
    expect(nextBucketCursor(at(40), { key: 'ArrowRight', extend: false, lastIndex: 5 })).toEqual(
      at(5),
    );
  });
});

describe('cursorBounds', () => {
  it('orders a forward range', () => {
    expect(cursorBounds({ anchor: 2, cursor: 7 })).toEqual({ start: 2, end: 7 });
  });

  it('orders a backward range', () => {
    expect(cursorBounds({ anchor: 7, cursor: 2 })).toEqual({ start: 2, end: 7 });
  });
});
