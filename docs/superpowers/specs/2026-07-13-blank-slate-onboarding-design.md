# Blank-slate onboarding — design

**Date:** 2026-07-13
**Branch:** `feat/blank-slate`
**Status:** Approved (pending spec review)

## Problem

A fresh install of MetricYak does not work. Starting the app against a new
database produces `500` errors on every request. The reported stack traces
show:

```
DrizzleQueryError: Failed query: select ... from "organizations" where "organizations"."id" = $1 limit $2
cause: Error: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
```

Every route handler (`list`/`create`/`update` in
`apps/metricyak/src/modules/projects/projects.routes.ts`) begins with
`organizations.get(organizationId)`, so the first DB touch fails and the whole
API is unusable.

### Root cause — three stacked failures

Investigation showed the reported error is only the first of three blockers
that a fresh install hits in sequence:

| Layer | State on a fresh install | Symptom if the layers above it were fixed |
|---|---|---|
| 1. Connection string | `DATABASE_URL=http://localhost:5432` — wrong scheme, **no credentials** | `SASL: client password must be a string` → the reported 500 |
| 2. Schema | No tables (migrations never applied) | `relation "organizations" does not exist` → still a 500 |
| 3. Data | No organization exists | `organizations.get` returns null → `404` — the real "blank slate" |

Key findings:

- `config.ts` validates `DATABASE_URL` only as `z.string().min(1)`, so a
  garbage-but-non-empty URL like `http://localhost:5432` passes validation and
  fails deep inside a request as an inscrutable SASL error.
- Nothing runs migrations or seeds on startup. `index.ts` connects and serves;
  migrations are the manual `pnpm db:migrate`, seed is the manual `pnpm db:seed`.
- **There is no organizations module.** `OrganizationsRepository` exposes only
  `get(id)`. The *only* way an organization has ever existed is the dev seed
  script inserting a hardcoded `DEV_ORG_ID`. A production install literally
  cannot obtain an organization without running the dev seed.
- The UI (`apps/metricyak-ui`) hardcodes the dev org id in
  `api/organizations.ts` and calls `GET /v1/organizations/{devOrgId}/projects`
  on load — the source of the "bunch of GET errors". `ProjectContext`'s
  bootstrap effect silently swallows both the empty-data case and a
  backend-down error.
- There is **no auth, no users, no accounts, no tenant scoping** anywhere. The
  app is effectively single-tenant and unauthenticated today.

## Goals

1. A fresh install works with **no seed script**. An organization is the one
   prerequisite, and the app provides a first-class way to create it.
2. Onboarding creates the first organization (and a user-named first project),
   rather than auto-provisioning a magic "Default" org/project.
3. Configuration and setup mistakes fail fast with clear, actionable messages
   instead of cryptic driver errors.
4. The design leaves room for a later **auth / multi-tenant / billing** layer
   to wrap the same primitives without rework.

## Non-goals (explicitly deferred)

- Authentication, users, sessions, login.
- Multi-tenant isolation / access control.
- Cloud billing and sign-up.
- Auto-provisioning a default organization (rejected — onboarding instead).
- Auto-running migrations on boot (rejected — migrations stay explicit).

These are future sub-projects. The organization API built here is the shared
primitive both the self-hosted and future cloud modes rely on; the cloud layer
*wraps* it, it does not replace it.

## Deployment modes

- **Self-hosted (OSS) — built now.** App boots against an empty (migrated) DB,
  the UI detects zero organizations and shows onboarding, the user creates an
  org + first project, and lands in a working app. No auth.
- **Cloud-hosted (paid) — later.** Sign-up → account/auth → org(s) → members →
  billing, layered on top of the same `POST /v1/organizations` primitive.

---

## Design

### Section 1 — Backend: organizations module (shared primitive)

New module `apps/metricyak/src/modules/organizations/`, mirroring the structure
of the existing `projects` module (`*.routes.ts`, `*.schemas.ts`, and
registration in `modules/index.ts` / `module.ts`).

Endpoints:

- `GET /v1/organizations` → `OrganizationResponse[]` — list all organizations.
- `POST /v1/organizations` — body `{ name: string }`. The server derives a
  unique `slug` from `name`. Returns the created organization (`201`).

`OrganizationsRepository` (`packages/storage/src/repositories/organizations.repository.ts`)
gains, alongside the existing `get(id)`:

- `list(): Promise<OrganizationRecord[]>`
- `create(input: { name: string; slug: string }): Promise<OrganizationRecord>`

Slug generation: slugify `name` (lowercase, hyphenate, strip non-alphanumerics);
on collision, append a short disambiguating suffix. Slug uniqueness is enforced
by the existing unique constraint on `organizations.slug`; the repository/route
surfaces a collision as a clean error rather than a raw DB error.

**Interface contract:** given a name, the module creates exactly one
organization with a unique slug and returns it; listing returns all
organizations. It depends only on `OrganizationsRepository`. It can be tested
via `createApp(createContainer(...))` + `app.request(...)` with a stub DB, per
the project's route-test convention.

### Section 2 — Frontend: onboarding empty-state

**API layer** (`apps/metricyak-ui/src/api/organizations.ts`):

- Replace the hardcoded stub `listOrganizations()` with a real
  `GET /v1/organizations` call via `apiFetch`.
- Add `createOrganization(name: string): Promise<Organization>` →
  `POST /v1/organizations`.

**Explicit bootstrap status** in `ProjectContext`
(`apps/metricyak-ui/src/contexts/ProjectContext.tsx`): replace the current
silent-skip effect with an explicit status:

```
type BootstrapStatus = 'loading' | 'needs-onboarding' | 'ready' | 'error';
```

- Fetch organizations on mount.
- Fetch **fails** (network / non-2xx) → `'error'` — the backend is genuinely
  unreachable. This is distinct from having no data.
- Succeeds with `orgs.length === 0` → `'needs-onboarding'`.
- Succeeds with orgs → resolve active org/project as today → `'ready'`.

This fixes a real current bug: a down API currently looks identical to an empty
one, so onboarding must not appear just because the backend is off, and a down
backend must not render as a silent blank app.

**Onboarding screen** — new `apps/metricyak-ui/src/components/onboarding/OnboardingPage.tsx`.
`AppLayout` renders it instead of the normal shell when status is
`'needs-onboarding'`. Flow:

1. "Welcome — create your organization." User types the **org name** (required).
2. User types the **first project name** (required, user-chosen — no "Default").
3. On submit: `createOrganization(name)` then `createProject(org.id, projectName)`
   (reusing the existing `createProject` from `api/projects.ts`), set both
   active via `setActiveProject`, transition to `'ready'`, and enter the app.

Rationale for org + user-named project (not org-only, not auto-"Default"): a
project is the first useful thing anyway, and creating it here avoids
immediately dropping the user into a second empty state. Because the user names
it, it is not dead-weight to delete later.

**Error state**: when status is `'error'`, `AppLayout` shows a small
"can't reach the API" message instead of a silent blank screen.

### Section 3 — Config fail-fast, startup schema check, `.env.example`, README

- **Config validation** (`apps/metricyak/src/config.ts`): tighten
  `DATABASE_URL` from `z.string().min(1)` to reject non-`postgres`/`postgresql`
  schemes and credential-less URLs, with an actionable message, e.g.
  *"DATABASE_URL must be a `postgres://user:password@host:port/db` URL"*. The
  reported `http://localhost:5432` would then fail at load with a fixable
  message instead of a SASL error deep in a request.
- **Startup schema check**: after connecting, verify the expected schema is
  present (e.g. probe for the `organizations` table). If absent, exit with a
  clear message pointing to `pnpm db:migrate` — turning
  `relation "organizations" does not exist` into an actionable instruction.
  This preserves explicit migrations (below) while removing the cryptic error.
- **Migrations stay explicit** in both dev and prod. No auto-migrate on boot
  (risky with multiple instances; and keeping it manual lets us work on
  empty-state/onboarding UX deliberately). The startup schema check tells you
  when to run it.
- **No automatic seed.** A fresh install — including dev — goes through
  onboarding. `pnpm db:seed` remains available for scripted API testing that
  wants the fixed `DEV_ORG_ID`, but is never automatic.
- **`.env.example`** committed at the repo root with the correct
  `DATABASE_URL=postgres://metricyak:metricyak@localhost:5432/metricyak` and the
  other documented variables. Fresh clones copy it; no one hand-writes a broken
  URL.
- **README** (currently empty) gets a Getting Started section: what MetricYak
  is, the two deployment modes, prerequisites (Docker, pnpm, Node), and the
  quick-start sequence — copy `.env.example`, `docker compose up -d`,
  `pnpm --filter @metricyak/storage db:migrate`, `pnpm dev`, open the UI,
  complete onboarding. Environment variables can reference the existing table
  in `AGENTS.md`.

**Prod behavior summary:** an empty (migrated) database is valid and boots
cleanly. Config is validated fail-fast. Migrations are an explicit deploy step.
No seeding ever runs. Onboarding provides the organization.

---

## Data flow (fresh self-hosted install)

```
copy .env.example  →  docker compose up -d  →  db:migrate  →  pnpm dev
        │                     │                    │             │
   valid DATABASE_URL    Postgres up         schema created   API boots,
   (fail-fast if not)                        (schema check     serves
                                              passes)
        │
   open UI  →  GET /v1/organizations → []  →  status 'needs-onboarding'
        │
   Onboarding: name org + name first project
        │
   POST /v1/organizations  →  POST /v1/organizations/{id}/projects
        │
   set active org+project  →  status 'ready'  →  working app
```

## Error handling

| Failure | Before | After |
|---|---|---|
| Malformed `DATABASE_URL` | SASL error deep in a request (500) | Fail-fast at config load, actionable message |
| Migrations not run | `relation ... does not exist` (500) | Fail-fast at startup, "run `pnpm db:migrate`" |
| No organizations yet | Silent blank / hardcoded-stub 500s | Onboarding screen |
| Backend unreachable (UI) | Silent blank, indistinguishable from empty | Explicit "can't reach the API" state |
| Slug collision on create | (n/a — no endpoint) | Clean error, not a raw DB error |

## Testing

- **Organizations routes**: `createApp(createContainer(...))` + `app.request()`
  with a stub DB — list returns records, create returns `201` with a derived
  slug, duplicate name yields a distinct slug or a clean collision error.
- **Repository**: integration test (Testcontainers `postgres:17-alpine`, per
  existing pattern) for `list`/`create`/slug-uniqueness.
- **Config validation**: unit tests rejecting `http://`, credential-less, and
  empty URLs; accepting a valid `postgres://` URL.
- **UI bootstrap status**: `ProjectContext` resolves to `needs-onboarding`
  (empty list), `error` (fetch rejects), and `ready` (orgs present).
- **Onboarding flow**: component test creating org + project and transitioning
  to `ready`.

## Module boundaries (summary)

| Unit | Does | Depends on |
|---|---|---|
| `organizations` API module | List/create organizations over HTTP | `OrganizationsRepository` |
| `OrganizationsRepository` | Persist/query organizations, slug uniqueness | `Database` |
| `api/organizations.ts` (UI) | Typed client for the org endpoints | `apiFetch` |
| `ProjectContext` | Resolve bootstrap status + active org/project | org + project API clients |
| `OnboardingPage` | Collect org + project names, create, enter app | `ProjectContext`, org/project clients |
| config validation | Reject bad `DATABASE_URL` at load | zod |
| startup schema check | Refuse to serve without schema, point to migrate | `Database` |

## Open questions

None outstanding. All section-level decisions confirmed during brainstorming.
