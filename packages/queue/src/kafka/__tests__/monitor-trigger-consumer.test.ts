import { describe, expect, it } from 'vitest';
import { parseTriggerMessage } from '@/kafka/monitor-trigger-consumer.js';

describe('parseTriggerMessage', () => {
  it('returns null for a null value', () => {
    expect(parseTriggerMessage(null)).toBeNull();
  });

  it('returns null for malformed JSON without throwing', () => {
    expect(() => parseTriggerMessage(Buffer.from('{not json'))).not.toThrow();
    expect(parseTriggerMessage(Buffer.from('{not json'))).toBeNull();
  });

  it('returns null when name is missing', () => {
    const value = Buffer.from(JSON.stringify({ projectId: 'project-1' }));
    expect(parseTriggerMessage(value)).toBeNull();
  });

  it('returns null when projectId is not a string', () => {
    const value = Buffer.from(JSON.stringify({ projectId: 123, name: 'signup' }));
    expect(parseTriggerMessage(value)).toBeNull();
  });

  it('returns the trigger event for a well-formed message', () => {
    const value = Buffer.from(
      JSON.stringify({ projectId: 'project-1', name: 'signup', batchId: 'batch-1' }),
    );
    expect(parseTriggerMessage(value)).toEqual({ projectId: 'project-1', name: 'signup' });
  });
});
