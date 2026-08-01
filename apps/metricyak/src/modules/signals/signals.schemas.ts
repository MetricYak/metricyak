import { z } from '@hono/zod-openapi';

export const ProjectParams = z.object({
  projectId: z.uuid().openapi({ param: { name: 'projectId', in: 'path' } }),
});

export const SignalSourceParams = ProjectParams.extend({
  sourceId: z.uuid().openapi({ param: { name: 'sourceId', in: 'path' } }),
});

export const ConnectorSummary = z.object({
  provider: z.string().openapi({ description: 'The identifier a signal source stores.' }),
  configSchema: z.record(z.string(), z.unknown()).openapi({
    description: 'JSON Schema for this connector settings, for rendering the connect form.',
  }),
});

export const ConnectorListResponse = z.object({
  connectors: z.array(ConnectorSummary),
});

export const SignalSourceResponse = z.object({
  id: z.uuid(),
  name: z.string(),
  provider: z.string(),
  config: z.record(z.string(), z.unknown()),
  status: z.enum(['awaiting_first_delivery', 'healthy', 'failing']),
  lastDeliveryAt: z.string().nullable(),
  lastError: z.string().nullable(),
  secretConfigured: z.boolean(),
  webhookUrl: z.string(),
  createdAt: z.string(),
});

export const SignalSourceListResponse = z.object({
  sources: z.array(SignalSourceResponse),
});

export const CreateSignalSourceRequest = z.object({
  name: z.string().min(1).max(128),
  provider: z.string().min(1),
  config: z.record(z.string(), z.unknown()),
});

export const DeletedSignalSourceResponse = z.object({
  deleted: z.boolean(),
});

export const CreatedSignalSourceResponse = z.object({
  source: SignalSourceResponse,
  secret: z.string().openapi({
    description: 'Shown once. Paste it into the provider alongside the payload URL.',
  }),
});
