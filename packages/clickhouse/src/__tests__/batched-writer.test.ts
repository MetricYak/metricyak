import { describe, expect, it, vi } from 'vitest';
import { BatchedClickHouseWriter } from '@/batched-writer.js';

function fakeClient() {
  const inserts: { table: string; values: unknown[]; token?: string }[] = [];
  return {
    inserts,
    insert: vi.fn(
      async (args: {
        table: string;
        values: unknown[];
        clickhouse_settings?: { insert_deduplication_token?: string };
      }) => {
        inserts.push({
          table: args.table,
          values: args.values,
          token: args.clickhouse_settings?.insert_deduplication_token,
        });
      },
    ),
  };
}

describe('BatchedClickHouseWriter', () => {
  it('flushes when maxRows is reached, one insert per token', async () => {
    const client = fakeClient();
    const w = new BatchedClickHouseWriter(client as never, {
      table: 't',
      maxRows: 3,
      maxDelayMs: 10_000,
    });
    w.enqueue('a', [{ x: 1 }, { x: 2 }]);
    w.enqueue('b', [{ x: 3 }]); // total 3 → triggers flush
    await w.drain();
    expect(client.insert).toHaveBeenCalledTimes(2);
    expect(client.inserts.map((i) => i.token)).toEqual(['a', 'b']);
    expect(client.inserts[0]?.values).toEqual([{ x: 1 }, { x: 2 }]);
  });

  it('drain() flushes a partial buffer below the threshold', async () => {
    const client = fakeClient();
    const w = new BatchedClickHouseWriter(client as never, {
      table: 't',
      maxRows: 100,
      maxDelayMs: 10_000,
    });
    w.enqueue('a', [{ x: 1 }]);
    expect(client.insert).not.toHaveBeenCalled();
    await w.drain();
    expect(client.insert).toHaveBeenCalledTimes(1);
    expect(client.inserts[0]?.token).toBe('a');
  });
});
