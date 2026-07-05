import type { MiddlewareHandler } from 'hono';

/**
 * TODO(JWT): this is a placeholder auth seam, not real authentication. Dashboard user
 * login + JWT are landing in a future PR; swap this for real bearer-token verification
 * (and projectId authorization) then. The client already sends an Authorization header
 * so no frontend change will be needed when that lands.
 *
 * Until then this only enforces a shared dev token when one is configured, so local/dev
 * environments can run without any auth at all.
 */
export function livestreamAuth(devToken: string | undefined): MiddlewareHandler {
  return async (c, next) => {
    if (!devToken) {
      await next();
      return;
    }

    const header = c.req.header('Authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (token !== devToken) {
      return c.json([{ error_type: 'unauthorized_error', message: 'Unauthorized.' }], 401);
    }

    await next();
  };
}
