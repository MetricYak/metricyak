import { describe, expect, it } from 'vitest';
import {
  commitAnnouncement,
  cursorAnnouncement,
} from '@/components/metrics/explore/chart-announcement';
import type { MetricPoint } from '@/components/metrics/explore/explore-model';

const HOUR_MS = 60 * 60_000;
const START_MS = Date.UTC(2026, 6, 26, 0, 0);

function pointsOf(values: readonly (number | null)[]): MetricPoint[] {
  return values.map((value, index) => ({ startMs: START_MS + index * HOUR_MS, value }));
}

describe('cursorAnnouncement', () => {
  it('reads out the moment and its value when resting on one bucket', () => {
    const spoken = cursorAnnouncement(
      pointsOf([12.5, 4]),
      { anchor: 0, cursor: 0 },
      '1h',
      'decimal',
    );

    expect(spoken).toContain('12.50');
    expect(spoken).toMatch(/Jul 26/);
  });

  it('says the value is missing rather than staying silent', () => {
    const spoken = cursorAnnouncement(pointsOf([null]), { anchor: 0, cursor: 0 }, '1h', 'decimal');

    expect(spoken).toContain('—');
  });

  it('describes the span while the range is being extended', () => {
    const spoken = cursorAnnouncement(
      pointsOf([1, 2, 3, 4]),
      { anchor: 1, cursor: 3 },
      '1h',
      'decimal',
    );

    expect(spoken).toMatch(/^Selecting /);
    expect(spoken).toContain('3 hours');
  });

  it('reads a backwards extension in chronological order', () => {
    const forwards = cursorAnnouncement(
      pointsOf([1, 2, 3, 4]),
      { anchor: 1, cursor: 3 },
      '1h',
      'decimal',
    );
    const backwards = cursorAnnouncement(
      pointsOf([1, 2, 3, 4]),
      { anchor: 3, cursor: 1 },
      '1h',
      'decimal',
    );

    expect(backwards).toBe(forwards);
  });

  it('counts a single-bucket granularity without pluralising', () => {
    const spoken = cursorAnnouncement(pointsOf([1, 2]), { anchor: 0, cursor: 1 }, '1d', 'decimal');

    expect(spoken).toContain('2 days');
  });

  it('has nothing to say when the cursor falls outside the series', () => {
    expect(cursorAnnouncement([], { anchor: 0, cursor: 0 }, '1h', 'decimal')).toBe('');
  });
});

describe('commitAnnouncement', () => {
  it('confirms the committed span in the past tense', () => {
    const spoken = commitAnnouncement(pointsOf([1, 2, 3]), { start: 0, end: 2 }, '1h');

    expect(spoken).toMatch(/^Selected /);
    expect(spoken).toContain('3 hours');
  });

  it('names a one-bucket selection in the singular', () => {
    expect(commitAnnouncement(pointsOf([1, 2]), { start: 1, end: 1 }, '1h')).toContain('1 hour');
  });
});
