import { apiFetch } from '@/lib/api';

export type ConnectorField = {
  type?: string;
  description?: string;
  default?: unknown;
  items?: { type?: string };
};

export type ConnectorSchema = {
  properties?: Record<string, ConnectorField>;
  required?: string[];
};

export type Connector = {
  provider: string;
  configSchema: ConnectorSchema;
};

export type SignalSourceStatus = 'awaiting_first_delivery' | 'healthy' | 'failing';

export type SignalSource = {
  id: string;
  name: string;
  provider: string;
  config: Record<string, unknown>;
  status: SignalSourceStatus;
  lastDeliveryAt: string | null;
  lastError: string | null;
  secretConfigured: boolean;
  webhookUrl: string;
  createdAt: string;
};

export type CreatedSignalSource = {
  source: SignalSource;
  secret: string;
};

export function listConnectors(): Promise<{ connectors: Connector[] }> {
  return apiFetch<{ connectors: Connector[] }>('/v1/connectors');
}

export function listSignalSources(projectId: string): Promise<{ sources: SignalSource[] }> {
  return apiFetch<{ sources: SignalSource[] }>(`/v1/projects/${projectId}/signal-sources`);
}

export function createSignalSource(
  projectId: string,
  input: { name: string; provider: string; config: Record<string, unknown> },
): Promise<CreatedSignalSource> {
  return apiFetch<CreatedSignalSource>(`/v1/projects/${projectId}/signal-sources`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteSignalSource(
  projectId: string,
  sourceId: string,
): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/v1/projects/${projectId}/signal-sources/${sourceId}`, {
    method: 'DELETE',
  });
}
