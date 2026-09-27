# VeriBot

VeriBot is an AI-powered QA platform. Point it at a web application and it crawls
the app, generates test cases, executes them in a real browser (Playwright),
analyses failures, files bugs, and reports quality trends.

**The product idea:** turn an untested web app into a continuously verified,
regression-safe product. VeriBot discovers pages and flows, generates and runs E2E
tests, hunts flaky behaviour with AI root-cause analysis backed by a self-accumulating
pgvector knowledge base, and files bugs into GitHub/Jira.

---

## Table of contents

- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Running without Docker](#running-without-docker)
- [Environment variables](#environment-variables)
- [Architecture](#architecture)
- [Request lifecycle](#request-lifecycle)
- [Project layout](#project-layout)
- [Multi-tenancy and authorization](#multi-tenancy-and-authorization)
- [Background jobs](#background-jobs)
- [Testing](#testing)
- [Common tasks](#common-tasks)
- [Deployment](#deployment)
- [Implementation status](#implementation-status)

---

## Requirements

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | **>= 20.0.0** | enforced by `engines` in `package.json` |
| PostgreSQL | 14+ | must have the **pgvector** extension available |
| Redis | 6+ | used for BullMQ, caching, and rate limiting |
| Docker | optional | only used to run Postgres/Redis locally |
| Playwright browsers | optional | `npx playwright install chromium` |

The API is a single Node package; the frontend lives in `web/` and has its own
`package.json`.

## Quick start

```bash
# 1. Install dependencies (backend + frontend)
npm install
npm install --prefix web

# 2. Start Postgres + Redis
docker compose up -d postgres redis

# 3. Configure the environment
cp .env.example .env       # then edit it — see "Environment variables"

# 4. Create the database schema
npm run prisma:deploy      # applies existing migrations
# or, to create a new migration from schema changes:
npm run prisma:migrate

# 5. Seed roles/permissions (optional but recommended)
npm run prisma:seed

# 6. Start both dev servers
./start-dev.sh
```

- API: <http://localhost:4000/api/v1>
- Health check: <http://localhost:4000/api/v1/health>
- Frontend: <http://localhost:5173>

Prefer separate terminals?

```bash
npm run dev                        # terminal 1 — API + workers, watches files
npm run dev --prefix web           # terminal 2 — Vite dev server
```

The frontend dev server proxies `/api` to the backend, so no CORS configuration
is needed for local development.

## Running without Docker

`start-dev.sh` requires a running Docker daemon. If you have Postgres and Redis
installed natively, skip it and run the two dev servers directly.

The API needs a `veribot_test` database in addition to `veribot` before you can
run the test suite:

```bash
createdb veribot
createdb veribot_test
```

Then set `DATABASE_URL` for the app and `TEST_DATABASE_URL` for Jest. Without
`TEST_DATABASE_URL`, the integration suites fall back to appending
`_test` to the database name.

## Environment variables

Configuration is validated at boot by a Zod schema in
[`src/config/environment.ts`](src/config/environment.ts) — the process **refuses to
start** if a required variable is missing, so a typo fails loudly instead of at
3am. Start from [`.env.example`](.env.example).

### Required

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | signing secrets for the two token types |
| `ENCRYPTION_KEY` | key used to encrypt integration config and test credentials at rest |
| `APP_ORIGIN` / `FRONTEND_ORIGIN` | public URLs, used for links and CORS |

### Usually required in production

`CORS_ORIGINS` (comma-separated allowlist), `SENDGRID_API_KEY` + `EMAIL_FROM`
(outbound email), `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (billing),
`AWS_*` (S3 uploads for screenshots/videos), `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`
(OAuth), and the `OPENAI_*` / `GEMINI_API_KEY` / `HUGGINGFACE_API_KEY` triplet.

### Development conveniences

- **`AI_PROVIDER=mock`** returns deterministic canned LLM responses. Everything
  works end-to-end without any API key — this is the default in `.env.example`.
- **`EMAIL_PROVIDER=log`** prints emails to stdout instead of sending them, so
  you can click verification links straight from the terminal.
- **`REQUIRE_EMAIL_VERIFICATION=false`** skips the verification gate locally.
  Leave it `true` everywhere else.

### Rate limiting

| Variable | Default | Applies to |
| --- | --- | --- |
| `RATE_LIMIT_WINDOW_MS` | `60000` | general API limiter |
| `RATE_LIMIT_MAX` | `100` | general API limiter |
| `RATE_LIMIT_AUTH_WINDOW_MS` | `900000` (15 min) | auth routes |
| `RATE_LIMIT_AUTH_MAX` | `20` | auth routes |

## Architecture

```text
                        Browser
                          │
                          ▼
                 ┌────────────────────┐
                 │  React SPA (Vite)  │  web/
                 │  React Query +     │
                 │  Zustand + RHF    │
                 └─────────┬──────────┘
                           │  /api  (proxied in dev)
                           ▼
                 ┌────────────────────┐
                 │    Express 5 API   │  src/app.ts
                 │  helmet · cors ·   │
                 │  rate limit · pino │
                 └─────────┬──────────┘
                           │
        ┌──────────────────┼───────────────────┐
        ▼                  ▼                   ▼
   middleware          services            repositories
  authenticate        (business logic)      (Prisma)
  tenantMiddleware         │                   │
  requirePermission        │                   │
  validate (Zod)          ▼                   │
                    AI agents · test        PostgreSQL + pgvector
                    runner · billing                │
                    GitHub/Jira/Slack         ┌────┴─────┐
                           │              Redis (queues)
                           ▼              + cache
                    BullMQ queues ──► workers (Playwright, analysis)
```

Three layers, strictly one-directional:

- **routes** declare the URL, the permission it requires, and which Zod schema
  validates each input.
- **controllers** own request/response translation only.
- **services** hold all business rules and are the only layer that coordinates
  other services.
- **repositories** wrap Prisma. Business logic should not import Prisma directly.

## Request lifecycle

```text
HTTP request
  → helmet security headers
  → CORS
  → rate limiter            (express-rate-limit)
  → pino-http request log
  → authenticate()          JWT access token, or x-api-key + x-org-id
  → tenantMiddleware()      resolves the active organization → req.orgId
  → requirePermission()     RBAC check against the caller's role
  → validate(schema, ...)   Zod: body / query / params
  → controller
  → service
  → repository → Prisma → PostgreSQL
```

The API exposes **110 endpoints** across 16 routers:

| Prefix | Responsibility |
| --- | --- |
| `/auth` | register, verify email, login, 2FA, refresh, logout, OAuth |
| `/users` | profile, password change, user management |
| `/organizations` | orgs, members, invitations, roles, audit logs |
| `/projects` | projects, archive, dashboard |
| `/applications` | target applications, environments, test users |
| `/test-cases` | CRUD, duplicate, archive, AI generation |
| `/test-suites` | suites and suite membership |
| `/test-runs` | enqueue runs, results, logs, screenshots |
| `/bugs` | CRUD, status, assignee, comments, GitHub reporting |
| `/agents` | AI agent runs and traces |
| `/integrations` | GitHub, Jira, Slack, Sentry, CircleCI config |
| `/webhooks` | outbound webhook registration and deliveries |
| `/analytics` | quality metrics, trends, reports |
| `/api-keys` | API key issue/list/revoke |
| `/billing` | plans, subscription, usage, Stripe webhook |
| `/health` | liveness and readiness |

## Project layout

```text
VeriBot/
├── prisma/
│   ├── schema.prisma          39 models
│   └── migrations/            6 migrations
├── src/
│   ├── app.ts                 createApp(): the Express app, no side effects
│   ├── server.ts              listener, worker boot, graceful shutdown
│   ├── config/                env, db, redis, queue, aws, logger
│   ├── constants/             messages, permissions, roles
│   ├── controllers/           HTTP translation only
│   ├── routes/api/v1/         routers + permission middleware
│   ├── services/              business logic
│   │   ├── ai/                provider abstraction + agents
│   │   ├── analytics/  auth/  billing/  bug/  cache/
│   │   ├── integration/       GitHub, Jira, Slack, Sentry, CircleCI
│   │   └── test/              test case + run orchestration
│   ├── repositories/          Prisma data access
│   ├── jobs/                  job handlers
│   ├── queues/                BullMQ queue definitions
│   ├── workers/               worker bootstrap
│   ├── middleware/            auth, tenant, rbac, validation, errors
│   ├── validators/            Zod schemas
│   ├── utils/                 errors, formatters, helpers
│   └── types/
├── __tests__/
│   ├── unit/                  no I/O
│   ├── integration/           real Postgres + Redis, via supertest
│   ├── fixtures/              app + user factories, DB reset
│   ├── rbac.test.ts
│   └── validation.test.ts
├── web/src/
│   ├── api/                   typed axios clients
│   ├── pages/                 one directory per feature area
│   ├── components/  hooks/  store/  lib/
└── docker-compose.yml
```

### `app.ts` vs `server.ts`

`src/app.ts` exports `createApp()`, which builds the Express app and **starts
nothing** — no port binding, no workers, no connections. `src/server.ts` imports
it, boots the workers, and listens. This split is what makes the integration
tests possible: they mount the same app the server mounts, without fighting over
port 4000.

## Multi-tenancy and authorization

Every request is scoped to exactly one organization, resolved by
`tenantMiddleware` into `req.orgId`. There are three ways to authenticate:

1. **JWT access token** in `Authorization: Bearer …`. The token carries the
   caller's role for the active org; `x-org-id` overrides which of your orgs is
   active, and is rejected if you are not a member.
2. **API key** via `x-api-key: vrb_…` **plus** `x-org-id`. Keys are stored as
   SHA-256 hashes and only ever displayed once, at creation.
3. **Optional auth** for public endpoints that behave differently when signed in.

Roles are `OWNER`, `ADMIN`, `QA_MANAGER`, `DEVELOPER`, `TESTER`, `VIEWER`, mapped
to granular permissions in [`src/constants/permissions.ts`](src/constants/permissions.ts).

> **Path parameters are not authorization.** A route like
> `PATCH /organizations/:organizationId` authorizes against the caller's org,
> but the *target* org comes from the URL. Every organization controller
> therefore re-checks membership against `:organizationId` via
> `assertMembership` before acting. The same applies to any resource that carries
> an `organizationId`: a controller must confirm it belongs to `req.orgId`
> instead of trusting a foreign id that passed validation.
> [`__tests__/integration/organizations/tenancy.test.ts`](__tests__/integration/organizations/tenancy.test.ts)
> is the regression guard for this.

## Background jobs

Long-running work never happens inside a request. The API enqueues and returns.

| Queue | Handler | Work |
| --- | --- | --- |
| `testQueue` | `testExecution` | run test cases in Playwright, store results/evidence |
| `aiQueue` | `aiExploration`, `failureAnalysis` | crawl the app; root-cause a failure; cost tracking |
| `reportQueue` | `reportGeneration` | quality reports |
| `webhookQueue` | `webhookDelivery` | signed outbound webhook calls with retries |

Queue names are namespaced per `NODE_ENV` (see `src/config/queue.ts`), so a test
run never shares BullMQ state with a dev server running alongside it.

## Testing

```bash
npm test              # everything, serially
npm run test:unit     # fast: no Postgres or Redis needed
npm run test:integration
npm run typecheck
npm run lint
```

The integration suites drive the real Express app with
[supertest](https://github.com/ladjs/supertest) against a **real** Postgres and
Redis — no mocked Prisma. That is deliberate: tenancy bugs, transaction
behaviour, and Prisma query mistakes are precisely what a mocked database hides.

Each integration file truncates `veribot_test` in `beforeEach`, so **the suites
must run serially** — which is why `npm test` passes `--runInBand`. Running
`npx jest` directly without that flag will produce flaky failures.

`__tests__/fixtures/testApp.ts` provides `request()`, `createTestUser()`, and
`resetDatabase()`, and closes queues/Redis on teardown so Jest can exit.

Current state: **174 tests across 11 suites, all passing.**

| Suite | What it covers |
| --- | --- |
| `unit/utils`, `unit/validators` | slug resolution, pagination, JWT, Zod schemas |
| `rbac`, `validation` | permission matrix, validator edge cases |
| `integration/auth` | register → verify → login → refresh → `/users/me`, password change |
| `integration/organizations` | cross-tenant isolation, membership, role changes |
| `integration/projects` | CRUD, pagination, archiving, dashboard |
| `integration/testCases` | CRUD, duplicate, archive, filters, generation |
| `integration/bugs` | CRUD, status, assignment, comments, filters |
| `integration/apiKeys` | issue/revoke, hash never exposed, API-key auth |

## Common tasks

```bash
npm run dev                 # API + workers with reload
npm run build               # compile to dist/
npm start                   # run the compiled server
npm run typecheck           # tsc --noEmit
npm run lint                # eslint
npm run format              # prettier --write

npm run prisma:generate     # regenerate the client after schema edits
npm run prisma:migrate      # create + apply a migration
npm run prisma:deploy       # apply migrations only (CI/production)
npm run prisma:seed         # seed roles and permissions

npm run dev --prefix web    # frontend
npm run build --prefix web  # typecheck + production build
npm run lint --prefix web
```

Playwright needs its browser binaries once:

```bash
npx playwright install chromium
```

## Deployment

Split the three workloads — they have very different resource profiles:

```text
Browser → static web build (Vercel/Netlify/S3+CDN)
        → API        (stateless; horizontal scaling)
        → Worker     (Playwright; CPU/RAM heavy, scales on queue depth)
        → PostgreSQL (managed: RDS/Neon/Supabase)
        → Redis      (managed: ElastiCache/Upstash)
        → S3         (screenshots, videos, attachments)
```

`Dockerfile` and `docker-compose.yml` cover the API and its dependencies. The API
is stateless apart from Postgres/Redis, so it scales horizontally; run the
workers as a separate process (`src/workers/index.ts`) so browser automation
never competes with request handling.

Before production: set `REQUIRE_EMAIL_VERIFICATION=true`, replace every secret,
set an explicit `CORS_ORIGINS` allowlist, and configure real S3 and Stripe keys.

## Implementation status

**Implemented and exercised by tests:** auth (email verification gate, JWT access
+ refresh, 2FA, GitHub OAuth), organizations/members/RBAC, API keys, projects,
applications, test cases, test suites, test runs, bugs, analytics, integrations,
webhooks, billing + Stripe webhook, audit logs, notifications, AI test
generation, and failure analysis.

**Implemented but only partially verified:** Playwright browser execution, GitHub
issue mirroring, Jira/Slack delivery, and the pgvector knowledge base. These need
real credentials and a real target site, so they are exercised by the development
smoke flow rather than by the automated suite.

**Not implemented:** the AI fix agent's end-to-end PR workflow and any genuine
deployment pipeline (Terraform/Kubernetes/GitHub Actions). Integration config is
encrypted and stored, but no outbound code-hosting automation runs in production.
