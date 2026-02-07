# CLAUDE.md

This file provides guidance on how to work with the metricyak repository.

## Overview of project
metricyak is a developer-first workflow automation platform, which uses metrics to trigger workflows, written in TypeScript, using a monorepo structure managed by pnpm workspace using bun as the runtime.

## Architecture

**Monorepo Structure:** pnpm workspace with turbo build orchestration

### Key Architectural Patterns

- **Event-Driven**: Uses BullMQ for communication

### Code Quality
- `pnpm typecheck` - run this for typechecks
- `pnpm lint` - run this for linting

## Technology Stack
- **Runtime:** bun for the run time and TypeScript as the language
- **Testing:** vitest
- **Code Quality:** Biome for formatting + ESLint

## Development Commands
- **Install:** `pnpm install`
- **Build:** `pnpm build`
- **Test:** `pnpm test`
- Run `pnpm typecheck` for verification of types

## Code Style & Patterns
- **TypeScript:** Strict mode enabled. Use interfaces for public contracts, types for internal data shapes. Never use `any` type instead use proper types or `unknown`
- **CLI Design:** Follow oclif best practices. Use `Command` classes with clear flags and args. Output should be JSON-friendly for automation but human-readable by default.
- **Errors:** Use custom error classes but make them user friendly when being returned and never return intricate details of the error. "Active Infrastructure" requires high reliability; catch and log failures without crashing the event loop.
- **Async:** Prefer `async/await` over raw promises. Use `Promise.all` for parallel workflow execution.

## Testing Guidelines
- Use **vitest** for all suites.
- **Mocking:** Use mock service worker for external http calls and mock other objects.

## Core Philosophy: "Active Infrastructure"
1. **Low Latency:** Any metric evaluation must be fast.
2. **Pluggable AI:** AI features are optional extensions. Core logic must run without an LLM.
3. **Open Source First:** The engine is open; the managed service adds convenience/scale.