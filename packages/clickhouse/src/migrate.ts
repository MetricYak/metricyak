import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ClickHouseClient } from '@/client.js';

const MIGRATIONS = ['0001_metric_buckets.sql', '0002_events.sql'] as const;

export async function migrate(client: ClickHouseClient): Promise<void> {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
  for (const file of MIGRATIONS) {
    const query = (await readFile(path.join(dir, file), 'utf8')).trim().replace(/;\s*$/, '');
    await client.command({ query });
  }
}
