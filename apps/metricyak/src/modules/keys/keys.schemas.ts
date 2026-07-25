import { z } from '@hono/zod-openapi';

export const ProjectKeyParams = z.object({
  projectId: z.uuid().openapi({
    param: { name: 'projectId', in: 'path' },
    example: 'd6ceaf26-fd71-4c38-90f1-2de20b946d00',
  }),
});

const ActiveProjectKey = z
  .object({
    key: z.string().openapi({
      description: 'The publishable project key. Safe to embed in client applications.',
      example: 'myk_bV69kLXz4PqRmaSTV2NZeK7YdJjMhKFWgqi5fexR9s2',
    }),
    createdAt: z.iso.datetime(),
    lastUsedAt: z.iso.datetime().nullable().openapi({
      description: 'When this key last authenticated an ingest request, to the nearest minute.',
    }),
  })
  .openapi('ActiveProjectKey');

const GraceProjectKey = z
  .object({
    key: z.string().openapi({
      description: 'The previous key, still accepted until it expires.',
      example: 'myk_9fKm2QwErTyUiOpAsDfGhJkLzXcVbNm1QwErTyU',
    }),
    expiresAt: z.iso.datetime().openapi({
      description: 'When the previous key stops being accepted.',
    }),
  })
  .openapi('GraceProjectKey');

export const ProjectKeyStateResponse = z
  .object({
    active: ActiveProjectKey.nullable(),
    grace: GraceProjectKey.nullable(),
  })
  .openapi('ProjectKeyState');
