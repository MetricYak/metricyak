import { apiFetch } from '@/lib/api';

export const MONITOR_OPERATORS = ['lt', 'lte', 'gt', 'gte', 'eq', 'neq'] as const;
export type ConditionOperator = (typeof MONITOR_OPERATORS)[number];

export const MONITOR_MISSING_DATA_STRATEGIES = ['skip', 'zero', 'fire'] as const;
export type MissingData = (typeof MONITOR_MISSING_DATA_STRATEGIES)[number];

export type MonitorStatus = 'ok' | 'pending' | 'firing';

export const MONITOR_STATUS_FILTERS = ['watching', 'pending', 'firing', 'error', 'paused'] as const;
export type MonitorStatusFilter = (typeof MONITOR_STATUS_FILTERS)[number];

export type MonitorCondition = {
  operator: ConditionOperator;
  value: number;
};

export type Monitor = {
  monitorId: string;
  name: string;
  description?: string | null;
  metricId: string;
  condition: MonitorCondition;
  window: string;
  holdFor: string;
  enabled: boolean;
  missingData: MissingData;
  evalHealth: 'ok' | 'error';
  status: MonitorStatus | null;
  lastValue: number | null;
  lastEvaluatedAt?: string | null;
  lastEvalError?: string | null;
  createdOn: string;
  updatedOn: string;
};

export type CreateMonitorInput = {
  name: string;
  description?: string;
  metricId: string;
  condition: MonitorCondition;
  window: string;
  holdFor: string;
  enabled: boolean;
  missingData: MissingData;
};

export type MonitorsPage = {
  monitors: Monitor[];
  hasMore: boolean;
};

export function listMonitors(
  projectId: string,
  params?: { page?: number; pageSize?: number; q?: string; status?: MonitorStatusFilter },
): Promise<MonitorsPage> {
  const query = new URLSearchParams();
  if (params?.page != null) query.set('page', String(params.page));
  if (params?.pageSize != null) query.set('pageSize', String(params.pageSize));
  if (params?.q) query.set('q', params.q);
  if (params?.status) query.set('status', params.status);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<MonitorsPage>(`/v1/projects/${projectId}/monitors${suffix}`);
}

export function getMonitor(projectId: string, monitorId: string): Promise<Monitor> {
  return apiFetch<Monitor>(`/v1/projects/${projectId}/monitors/${monitorId}`);
}

export function createMonitor(projectId: string, input: CreateMonitorInput): Promise<Monitor> {
  return apiFetch<Monitor>(`/v1/projects/${projectId}/monitors`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function setMonitorEnabled(
  projectId: string,
  monitorId: string,
  enabled: boolean,
): Promise<Monitor> {
  return apiFetch<Monitor>(`/v1/projects/${projectId}/monitors/${monitorId}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}

export function deleteMonitor(projectId: string, monitorId: string): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/v1/projects/${projectId}/monitors/${monitorId}`, {
    method: 'DELETE',
  });
}
