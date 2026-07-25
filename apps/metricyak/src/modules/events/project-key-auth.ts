import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '@/container/container.js';
import { UnauthorizedError } from '@/http/errors.js';

export function extractBearerKey(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return null;
  return value && value.length > 0 ? value : null;
}

export function projectKeyAuth(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const presented = extractBearerKey(c.req.header('Authorization'));
    if (!presented) {
      throw new UnauthorizedError('You are not allowed to perform this action.');
    }

    const now = new Date();
    const { repos, lastUsed } = c.var.container;
    const record = await repos.projectKeys.findValidByKey(presented, now);
    if (!record) {
      throw new UnauthorizedError('You are not allowed to perform this action.');
    }

    if (lastUsed.shouldWrite(record.id, now)) {
      await repos.projectKeys.touchLastUsed(record.id, now);
    }

    c.set('projectKey', record);
    await next();
  };
}
