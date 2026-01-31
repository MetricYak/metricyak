# @metricyak/cli

MetricYak CLI - Command line interface for MetricYak platform.

## Installation

From the monorepo root:

```bash
bun install
bun run build
```

## Usage

The main command is `yak` with various subcommands.

### Worker Command

Start the MetricYak worker process:

```bash
yak worker
```

#### Options

- `-c, --concurrency <number>` - Number of concurrent jobs to process (default: 5)
- `-q, --queue <name>` - Queue name to process (default: metricyak)
- `-h, --redis-host <host>` - Redis host (default: localhost)
- `-p, --redis-port <port>` - Redis port (default: 6379)

#### Examples

```bash
# Start worker with default settings
yak worker

# Start worker with custom concurrency
yak worker --concurrency 10

# Start worker with custom Redis connection
yak worker --redis-host redis.example.com --redis-port 6380

# Start worker with custom queue name
yak worker --queue my-custom-queue
```

## Development

```bash
# Watch mode for development
bun run dev

# Build
bun run build

# Run tests
bun run test

# Type checking
bun run lint
```

## Architecture

The CLI uses Commander.js to define commands and spawns Node.js processes to run the actual workers. This allows for:

- Clean separation between CLI and worker logic
- Easy addition of new commands
- Proper process management and graceful shutdown
- Environment variable passing to worker processes
