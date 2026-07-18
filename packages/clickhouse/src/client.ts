import { type ClickHouseClient, createClient } from '@clickhouse/client';

export type { ClickHouseClient };

export function createClickHouseClient(url: string): ClickHouseClient {
  const parsed = new URL(url);
  const database = parsed.pathname.replace(/^\//, '') || 'default';
  const username = decodeURIComponent(parsed.username) || 'default';
  const password = decodeURIComponent(parsed.password) || '';
  const origin = `${parsed.protocol}//${parsed.host}`;
  return createClient({ url: origin, username, password, database });
}
