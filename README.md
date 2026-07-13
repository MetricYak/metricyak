# MetricYak

Self-hostable product analytics. MetricYak can run two ways: **self-hosted**
(open source) or, in future, a **cloud-hosted** version. Both share the same
core: you create an organization and a project, then send events.

## Prerequisites

- Node.js and [pnpm](https://pnpm.io/)
- Docker (for Postgres and Redis via `docker-compose`)

## Getting started

1. **Copy the environment file** and adjust if needed:
   ```bash
   cp .env.example .env
   ```
   `DATABASE_URL` must be a credentialed `postgres://` URL — the app refuses to
   start otherwise, with a message telling you what's wrong.

2. **Start Postgres and Redis:**
   ```bash
   docker compose up -d
   ```

3. **Apply database migrations** (explicit — never run automatically):
   ```bash
   pnpm --filter @metricyak/storage db:migrate
   ```

4. **Run the app** (inline worker, no Redis needed):
   ```bash
   pnpm dev
   ```

5. **Open the UI** and complete onboarding. On a fresh database there are no
   organizations yet, so the app shows a short onboarding screen: name your
   organization and your first project, and you're in.

## Blank slate & onboarding

A fresh install starts with an empty database. There is **no seed step** for
normal use — the app provides onboarding to create your first organization and
project. (`pnpm --filter @metricyak/storage db:seed` exists only as a
convenience for scripted testing with a fixed dev org id.)

If you start the app before running migrations, it fails fast and tells you to
run `db:migrate`.

## Environment variables

See the environment-variable table in [`AGENTS.md`](./AGENTS.md).

## Common commands

Run from the repo root:

| Task | Command |
|---|---|
| Dev server (inline worker) | `pnpm dev` |
| Build | `pnpm build` |
| Test | `pnpm test` |
| Type-check | `pnpm check-types` |
| Lint + format check | `pnpm ci` |

Database commands run from `packages/storage/` — see `AGENTS.md`.
