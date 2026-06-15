import { z } from '@hono/zod-openapi';

export const CreateMetricParams = z.object({
  projectId: z.uuid('Double check the value and try again.').openapi({
    param: { name: 'projectId', in: 'path' },
    example: 'd6ceaf26-fd71-4c38-90f1-2de20b946d00',
  }),
});

export const CreateMetricRequest = z.object({});

export const CreateMetricResponse = z.object({});
