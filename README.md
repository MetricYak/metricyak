# MetricYak

Metricyak is a platform that let's you use your metrics to trigger autonomous workflows. Run Active Infrastructure, SOPS. Developer-first and Open-Source.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (latest version)
- [pnpm](https://pnpm.io) (v9 or higher)
- Node.js 20 or higher

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

### Build

```bash
pnpm build
```

### Testing

```bash
pnpm test
```

### Type Checking

```bash
pnpm typecheck
```

### Linting & Formatting

```bash
# Check formatting
pnpm format:check

# Fix formatting
pnpm format

# Lint
pnpm lint
```

## Project Structure

```
metricyak/
├── apps/          # Application packages
├── packages/      # Shared packages
├── .github/       # GitHub workflows
├── .husky/        # Git hooks
└── ...
```

## Technology Stack

- **Runtime**: Bun
- **Package Manager**: pnpm
- **Build System**: Turborepo
- **Language**: TypeScript
- **Formatter/Linter**: Biome
- **Testing**: Vitest
