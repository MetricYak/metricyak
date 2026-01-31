# Project Name
MetricYak

## Description
A developer-first platform using metrics that come through webhooks or other sources to trigger workflow automations. Developer UX is important

## Repository set up
Monorepo with separation between open source and managed later on. Must use turborepo.

## CLI
Read the @packages/cli/src/README.md 

## Tech Stack
- Typescript
- BullMq
- Use Bun/hono for any APIs we build
- node.js for the bullmq worker
- zod for validation


## Code Style
- Follow software design principles like separation of concerns, dependency injection if required, classes if needed.
- type safety is of vital importance
- Code must be tested