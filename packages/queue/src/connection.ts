import type { ConnectionOptions } from 'bullmq';

export function createWorkerConnectionOptions(redisUrl: string): ConnectionOptions {
  return { maxRetriesPerRequest: null, lazyConnect: false, ...parseRedisUrl(redisUrl) };
}

export function createProducerConnectionOptions(redisUrl: string): ConnectionOptions {
  return { maxRetriesPerRequest: 1, lazyConnect: false, ...parseRedisUrl(redisUrl) };
}

function parseRedisUrl(url: string): {
  host: string;
  port: number;
  password?: string;
  db?: number;
} {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    ...(parsed.pathname && parsed.pathname !== '/' ? { db: Number(parsed.pathname.slice(1)) } : {}),
  };
}
