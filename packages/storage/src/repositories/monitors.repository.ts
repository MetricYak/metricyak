import type { Database } from '../client.js';
import { type MonitorCondition, type MonitorScope, monitors } from '../schema/monitors.js';

export type CreateMonitorInput = {
  projectId: string;
  metricId: string;
  name: string;
  description?: string | null;
  scope?: MonitorScope | null;
  condition: MonitorCondition;
  window: string;
  holdFor: string;
  workflowId?: string | null;
};

export type MonitorRecord = {
  id: string;
  projectId: string;
  metricId: string;
  name: string;
  description: string | null;
  scope: MonitorScope | null;
  condition: MonitorCondition;
  window: string;
  holdFor: string;
  workflowId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class MonitorsRepository {
  constructor(private readonly db: Database) {}

  async create(input: CreateMonitorInput): Promise<MonitorRecord> {
    const [monitor] = await this.db
      .insert(monitors)
      .values({
        projectId: input.projectId,
        metricId: input.metricId,
        name: input.name,
        description: input.description ?? null,
        scope: input.scope ?? null,
        condition: input.condition,
        window: input.window,
        holdFor: input.holdFor,
        workflowId: input.workflowId ?? null,
      })
      .returning();

    if (!monitor) {
      throw new Error('Failed to insert monitor.');
    }

    return monitor;
  }
}
