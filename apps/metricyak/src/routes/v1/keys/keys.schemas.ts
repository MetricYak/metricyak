import { z } from '@hono/zod-openapi';

const ProjectIdParam = z.object({
  projectId: z.uuid().openapi({
    param: { name: 'projectId', in: 'path' },
    example: 'd6ceaf26-fd71-4c38-90f1-2de20b946d00',
  }),
});

const KeyIdParam = z.object({
  projectId: z.uuid().openapi({
    param: { name: 'projectId', in: 'path' },
    example: 'd6ceaf26-fd71-4c38-90f1-2de20b946d00',
  }),
  keyId: z.uuid().openapi({
    param: { name: 'keyId', in: 'path' },
    example: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
  }),
});

export const CreateProjectKeyParams = ProjectIdParam;
export const ListProjectKeysParams = ProjectIdParam;
export const RevokeProjectKeyParams = KeyIdParam;

export const CreateProjectKeyRequest = z.object({
  name: z.string().min(1, 'The name must not be empty.').openapi({
    description: 'A human-readable label for this project key (e.g. "Production iOS").',
    example: 'Production iOS',
  }),
});

export const CreateProjectKeyResponse = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  name: z.string(),
  key: z.string().openapi({
    description: 'The project key.',
    example: 'myk_bV69kLXz4PqRmaSTV2NZeK7YdJjMhKFWgqi5fexR9s2',
  }),
  createdAt: z.iso.datetime(),
});

const ProjectKeySummary = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  name: z.string(),
  createdAt: z.iso.datetime(),
  revokedAt: z.iso.datetime().nullable(),
});

export const ListProjectKeysResponse = z.array(ProjectKeySummary);

export const RevokeProjectKeyResponse = z.object({
  revoked: z.boolean(),
});
