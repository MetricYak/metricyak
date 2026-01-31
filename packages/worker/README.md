# @metricyak/worker

BullMQ worker package for processing MetricYak jobs.

## Overview

This package provides a type-safe worker implementation that listens to BullMQ queues and processes jobs. It's built with:

- **TypeScript** for type safety
- **BullMQ** for reliable job queue processing
- **Zod** for runtime validation
- **Vitest** for testing

## Installation

```bash
# Install dependencies
bun install
```

## Configuration

The worker can be configured via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `QUEUE_NAME` | Name of the BullMQ queue | `metricyak-jobs` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | - |
| `REDIS_DB` | Redis database number | `0` |
| `WORKER_CONCURRENCY` | Number of concurrent jobs | `10` |
| `RATE_LIMIT_MAX` | Max jobs per duration | `100` |
| `RATE_LIMIT_DURATION` | Rate limit duration (ms) | `60000` |

## Usage

### Development

```bash
# Run in development mode with hot reload
bun run dev
```

### Production

```bash
# Build the worker
bun run build

# Start the worker
bun run start
```

### Testing

```bash
# Run tests
bun run test

# Run tests in watch mode
bun run test:watch
```

## Architecture

The worker follows separation of concerns and dependency injection principles:

- **`worker.ts`** - Main worker class that wraps BullMQ Worker
- **`config.ts`** - Configuration management with environment variables
- **`types.ts`** - TypeScript types and Zod schemas for validation
- **`index.ts`** - Entry point with job processor function

## Customizing Job Processing

Replace the `processJob` function in [`index.ts`](src/index.ts) with your actual job processing logic:

```typescript
async function processJob(job: Job): Promise<unknown> {
  // Validate job data
  const data = MetricJobDataSchema.parse(job.data);

  // Process the job
  // Your logic here

  return { success: true };
}
```

## Type Safety

All job data is validated using Zod schemas. The default schema for metric jobs is:

```typescript
{
  metricName: string;
  value: number;
  timestamp: number;
  source: string;
  metadata?: Record<string, unknown>;
}
```

Modify the schemas in [`types.ts`](src/types.ts) to match your job data structure.

## Graceful Shutdown

The worker handles `SIGTERM` and `SIGINT` signals for graceful shutdown:

- Stops accepting new jobs
- Waits for active jobs to complete
- Closes Redis connections
- Exits cleanly
