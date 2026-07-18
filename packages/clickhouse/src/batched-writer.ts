import type { ClickHouseClient } from '@/client.js';

export type Row = Record<string, unknown>;

type Options = { table: string; maxRows?: number; maxDelayMs?: number };

export class BatchedClickHouseWriter {
  private readonly maxRows: number;
  private readonly maxDelayMs: number;
  private buffer: { token: string; rows: Row[] }[] = [];
  private pending = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly client: ClickHouseClient,
    opts: Options,
  ) {
    this.table = opts.table;
    this.maxRows = opts.maxRows ?? 50_000;
    this.maxDelayMs = opts.maxDelayMs ?? 2_000;
  }
  private readonly table: string;

  enqueue(token: string, rows: Row[]): void {
    if (rows.length === 0) return;
    this.buffer.push({ token, rows });
    this.pending += rows.length;
    if (this.pending >= this.maxRows) {
      void this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => void this.flush(), this.maxDelayMs);
    }
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const batches = this.buffer;
    this.buffer = [];
    this.pending = 0;
    for (const { token, rows } of batches) {
      await this.client.insert({
        table: this.table,
        format: 'JSONEachRow',
        values: rows,
        clickhouse_settings: { insert_deduplication_token: token },
      });
    }
  }

  async drain(): Promise<void> {
    await this.flush();
  }
}
