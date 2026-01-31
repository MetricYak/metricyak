# MetricYak

A developer first platform using metrics that come through webhooks or other sources to trigger workflow automations.

## Project Structure

This is a monorepo managed with Turborepo:

```
metricyak/
├── packages/
│   ├── cli/             # Command-line interface
│   └── worker/          # BullMQ worker for processing jobs
└── turbo.json           # Turborepo configuration
```

## Getting Started

### Prerequisites

- Node.js >= 22.0.0
- Bun 1.3.6+
- Redis (for BullMQ)

### Installation

```bash
# Install dependencies
bun install
```

### Development

```bash
# Build all packages
bun run build

# Run all packages in development mode
bun run dev

# Run tests across all packages
bun run test

# Lint all packages
bun run lint
```

### Using the CLI

```bash
# Build the CLI first
bun run build

# Run the CLI
node packages/cli/dist/index.js --help

# Start the worker
node packages/cli/dist/index.js worker

# Start worker with custom options
node packages/cli/dist/index.js worker --concurrency 10 --queue my-queue
```

## Packages

### @metricyak/cli

Command-line interface for MetricYak. Provides the `yak` command for managing workers and other operations.

See [`packages/cli/README.md`](packages/cli/README.md) for detailed documentation.

### @metricyak/worker

BullMQ worker for processing metric events and triggering workflow automations.

See [`packages/worker/README.md`](packages/worker/README.md) for detailed documentation.

## Tech Stack

- **TypeScript** - Type-safe development
- **BullMQ** - Reliable job queue processing
- **Node.js** - Runtime for the worker
- **Bun/Hono** - For APIs (coming soon)
- **Zod** - Runtime validation
- **Vitest** - Testing framework
- **Turborepo** - Monorepo management

## Code Style

- Follow software design principles (separation of concerns, dependency injection)
- Type safety is paramount
- All code must be tested
- Use classes where appropriate

## License

MIT
