import { z } from 'zod';

/**
 * Job data schema for metric webhook events
 */
export const MetricJobDataSchema = z.object({
  metricName: z.string(),
  value: z.number(),
  timestamp: z.number(),
  source: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export type MetricJobData = z.infer<typeof MetricJobDataSchema>;

/**
 * Job result schema
 */
export const JobResultSchema = z.object({
  processed: z.boolean(),
  processedAt: z.number(),
  jobId: z.string(),
});

export type JobResult = z.infer<typeof JobResultSchema>;

/**
 * Worker configuration
 */
export interface WorkerConfig {
  queueName: string;
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  concurrency?: number;
  rateLimiter?: {
    max: number;
    duration: number;
  };
}
