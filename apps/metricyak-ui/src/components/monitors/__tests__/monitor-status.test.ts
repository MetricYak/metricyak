import { describe, expect, it } from 'vitest';
import { deriveMonitorStatus } from '@/components/monitors/monitor-status';

const base = { enabled: true, evalHealth: 'ok' as const, status: 'ok' as const };

describe('deriveMonitorStatus', () => {
  it('is Paused when disabled, whatever the status', () => {
    expect(deriveMonitorStatus({ ...base, enabled: false, status: 'firing' })).toEqual({
      label: 'Paused',
      tone: 'muted',
    });
  });
  it('is Error when eval health failed', () => {
    expect(deriveMonitorStatus({ ...base, evalHealth: 'error' })).toEqual({
      label: 'Error',
      tone: 'error',
    });
  });
  it('is Waiting before the first evaluation', () => {
    expect(deriveMonitorStatus({ ...base, status: null })).toEqual({
      label: 'Waiting',
      tone: 'muted',
    });
  });
  it('maps live statuses', () => {
    expect(deriveMonitorStatus({ ...base, status: 'firing' }).label).toBe('Firing');
    expect(deriveMonitorStatus({ ...base, status: 'pending' }).label).toBe('Pending');
    expect(deriveMonitorStatus({ ...base, status: 'ok' }).label).toBe('OK');
  });
});
