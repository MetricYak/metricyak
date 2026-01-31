import { describe, it, expect } from 'vitest';
import { MetricJobDataSchema, JobResultSchema } from '../types.js';

describe('MetricJobDataSchema', () => {
  it('should validate valid metric job data', () => {
    const validData = {
      metricName: 'api.response.time',
      value: 125.5,
      timestamp: Date.now(),
      source: 'api-gateway',
      metadata: {
        endpoint: '/api/users',
        method: 'GET',
      },
    };

    const result = MetricJobDataSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validData);
    }
  });

  it('should validate metric job data without optional metadata', () => {
    const validData = {
      metricName: 'cpu.usage',
      value: 75.2,
      timestamp: Date.now(),
      source: 'monitoring-agent',
    };

    const result = MetricJobDataSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject data with missing required fields', () => {
    const invalidData = {
      metricName: 'test.metric',
      value: 100,
      // missing timestamp and source
    };

    const result = MetricJobDataSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject data with wrong types', () => {
    const invalidData = {
      metricName: 'test.metric',
      value: 'not a number', // should be number
      timestamp: Date.now(),
      source: 'test-source',
    };

    const result = MetricJobDataSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject data with invalid metricName type', () => {
    const invalidData = {
      metricName: 123, // should be string
      value: 100,
      timestamp: Date.now(),
      source: 'test-source',
    };

    const result = MetricJobDataSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('JobResultSchema', () => {
  it('should validate valid job result', () => {
    const validResult = {
      processed: true,
      processedAt: Date.now(),
      jobId: 'job-123',
    };

    const result = JobResultSchema.safeParse(validResult);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validResult);
    }
  });

  it('should reject result with missing fields', () => {
    const invalidResult = {
      processed: true,
      // missing processedAt and jobId
    };

    const result = JobResultSchema.safeParse(invalidResult);
    expect(result.success).toBe(false);
  });

  it('should reject result with wrong types', () => {
    const invalidResult = {
      processed: 'yes', // should be boolean
      processedAt: Date.now(),
      jobId: 'job-123',
    };

    const result = JobResultSchema.safeParse(invalidResult);
    expect(result.success).toBe(false);
  });
});
