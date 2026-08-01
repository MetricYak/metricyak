import { createRoute } from '@hono/zod-openapi';
import { findSignalProvider, signalProviders } from '@metricyak/connectors';
import { Secret } from '@metricyak/secrets';
import type { SignalSourceRecord } from '@metricyak/storage';
import { z } from 'zod';
import { errorResponse, NotFoundError, ValidationError } from '@/http/errors.js';
import { respond } from '@/http/respond.js';
import { createRouter } from '@/http/router.js';
import { requireProject } from '@/http/scope.js';
import {
  ConnectorListResponse,
  CreatedSignalSourceResponse,
  CreateSignalSourceRequest,
  DeletedSignalSourceResponse,
  ProjectParams,
  SignalSourceListResponse,
  SignalSourceParams,
} from '@/modules/signals/signals.schemas.js';
import { generateWebhookSecret, webhookUrlFor } from '@/modules/signals/webhook-secret.js';

function sourceResponse(source: SignalSourceRecord, requestUrl: string) {
  return {
    id: source.id,
    name: source.name,
    provider: source.provider,
    config: source.config,
    status: source.status,
    lastDeliveryAt: source.lastDeliveryAt ? source.lastDeliveryAt.toISOString() : null,
    lastError: source.lastError,
    secretConfigured: source.secretId !== null,
    webhookUrl: webhookUrlFor(requestUrl, source.id),
    createdAt: source.createdAt.toISOString(),
  };
}

export const listConnectorsRoute = createRoute({
  method: 'get',
  path: '/connectors',
  responses: {
    200: {
      content: { 'application/json': { schema: ConnectorListResponse } },
      description: 'Every connector that can back a signal source, with its settings schema.',
    },
  },
});

export const listSignalSourcesRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}/signal-sources',
  request: { params: ProjectParams },
  responses: {
    200: {
      content: { 'application/json': { schema: SignalSourceListResponse } },
      description: 'The signal sources configured for this project.',
    },
    400: errorResponse('The request failed validation.'),
    404: errorResponse('The project could not be found.'),
  },
});

export const createSignalSourceRoute = createRoute({
  method: 'post',
  path: '/projects/{projectId}/signal-sources',
  request: {
    params: ProjectParams,
    body: { content: { 'application/json': { schema: CreateSignalSourceRequest } } },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: CreatedSignalSourceResponse } },
      description: 'The source was created. The secret is returned once and never again.',
    },
    400: errorResponse('The request failed validation, or the connector rejected the settings.'),
    404: errorResponse('The project could not be found.'),
    409: errorResponse('This project already has a source with that name.'),
  },
});

export const deleteSignalSourceRoute = createRoute({
  method: 'delete',
  path: '/projects/{projectId}/signal-sources/{sourceId}',
  request: { params: SignalSourceParams },
  responses: {
    200: {
      content: { 'application/json': { schema: DeletedSignalSourceResponse } },
      description: 'The source and every signal it recorded were removed.',
    },
    400: errorResponse('The request failed validation.'),
    404: errorResponse('The source could not be found.'),
  },
});

const signalsRouter = createRouter();

signalsRouter.openapi(listConnectorsRoute, (c) => {
  const connectors = signalProviders.map((provider) => ({
    provider: provider.provider,
    configSchema: z.toJSONSchema(provider.configSchema),
  }));

  return respond(c, ConnectorListResponse, { connectors }, 200);
});

signalsRouter.openapi(listSignalSourcesRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const { projects, signalSources } = c.var.container.repos;

  await requireProject(projects, projectId);

  const sources = await signalSources.listByProject(projectId);

  return respond(
    c,
    SignalSourceListResponse,
    { sources: sources.map((source) => sourceResponse(source, c.req.url)) },
    200,
  );
});

signalsRouter.openapi(createSignalSourceRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const { name, provider, config } = c.req.valid('json');
  const { projects, secrets, signalSources } = c.var.container.repos;

  await requireProject(projects, projectId);

  const connector = findSignalProvider(provider);
  if (!connector) {
    throw new NotFoundError(`No connector is registered for "${provider}".`, 'provider');
  }

  const settings = connector.configSchema.safeParse(config);
  if (!settings.success) {
    throw ValidationError.fromZodError(settings.error, config);
  }

  const storedConfig = z.record(z.string(), z.unknown()).safeParse(settings.data);
  if (!storedConfig.success) {
    throw ValidationError.fromZodError(storedConfig.error, config);
  }

  const plaintext = generateWebhookSecret();
  const secret = await secrets.create({
    projectId,
    name: `signal-source:${name}`,
    value: Secret.of(plaintext),
  });

  const source = await signalSources.create({
    projectId,
    name,
    provider: connector.provider,
    config: storedConfig.data,
    secretId: secret.id,
  });

  c.header('Cache-Control', 'no-store');
  return respond(
    c,
    CreatedSignalSourceResponse,
    { source: sourceResponse(source, c.req.url), secret: plaintext },
    201,
  );
});

signalsRouter.openapi(deleteSignalSourceRoute, async (c) => {
  const { projectId, sourceId } = c.req.valid('param');
  const { signalSources } = c.var.container.repos;

  const deleted = await signalSources.delete(sourceId, projectId);
  if (!deleted) throw new NotFoundError('The source could not be found.');

  return respond(c, DeletedSignalSourceResponse, { deleted }, 200);
});

export default signalsRouter;
