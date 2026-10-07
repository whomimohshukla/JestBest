# JestBest

JestBest is an AI-powered QA platform. Point it at a web application and it crawls
the app, generates test cases, executes them in a real browser (Playwright),
analyses failures, files bugs, and reports quality trends.

**The product idea:** turn an untested web app into a continuously verified,
regression-safe product. JestBest discovers pages and flows, generates and runs E2E
tests, hunts flaky behaviour with AI root-cause analysis backed by a self-accumulating
pgvector knowledge base, and files bugs into GitHub/Jira.

---

## Table of contents

- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Running without Docker](#running-without-docker)
- [Environment variables](#environment-variables)
- [Branding](#branding)
- [Architecture](#architecture)
- [Request lifecycle](#request-lifecycle)
- [Project layout](#project-layout)
- [Multi-tenancy and authorization](#multi-tenancy-and-authorization)
- [Background jobs](#background-jobs)
- [Performance](#performance)
- [Testing](#testing)
- [Frontend notes](#frontend-notes)
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

# 5b. Optional: seed a demo workspace (project, cases, 2 weeks of runs,
#     bugs, usage) so the dashboard and billing pages have data on a
#     fresh install. Creates demo@jestbest.dev / DemoPassword123! when
#     SEED_ADMIN_EMAIL is unset — change it before sharing the instance.
npm run seed:demo

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

The API needs a `jestbest_test` database in addition to `jestbest` before you can
run the test suite:

```bash
createdb jestbest
createdb jestbest_test
```

The final migration enables `pgvector` (`CREATE EXTENSION IF NOT EXISTS vector`)
for the incident-knowledge embedding column. Without it, `npm run prisma:deploy`
fails at that migration. Any Postgres 14+ with the extension available is fine;
it does not have to be the Docker image.

Then set `DATABASE_URL` for the app. The integration suites read
`TEST_DATABASE_URL` and, if it is unset, fall back to
`postgresql://jestbest:jestbest@localhost:5432/jestbest_test`. They deliberately
ignore `DATABASE_URL` so that a developer with the dev database exported can
never have the suite truncate it.

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

`CORS_ORIGINS` (comma-separated allowlist), `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (billing),
`AWS_*` (S3 uploads for screenshots/videos), `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`
and `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (OAuth sign-in for GitHub and
Google), and the `OPENAI_*` / `GEMINI_API_KEY` / `HUGGINGFACE_API_KEY` triplet.

Outbound email is either `EMAIL_PROVIDER=sendgrid` (needs `SENDGRID_API_KEY`) or
`EMAIL_PROVIDER=smtp`, which is handled by nodemailer and needs
`SMTP_HOST`, `SMTP_USER` and `SMTP_PASSWORD` (`SMTP_PORT` defaults to 587,
`SMTP_SECURE` to false, and `SMTP_FROM` defaults to `SMTP_USER` because Gmail
rejects a `From` address that is not the authenticated account). Gmail requires
an [App Password](https://support.google.com/accounts/answer/185833) with
2-Step Verification enabled — the account's normal password will not work.

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

### Password reset

`POST /auth/request-password-reset` always returns `200` (so it cannot be used to
enumerate accounts) and emails a single-use link when the address exists.

| Variable | Default | Notes |
| --- | --- | --- |
| `PASSWORD_RESET_EXPIRES_IN` | `1h` | Lifetime of the emailed reset token |

Reset tokens are **purpose-bound** (a normal access token is rejected) and
**single-use**: the token is consumed with a Redis `GETDEL`, so a replayed link
fails even if it is caught in transit. Completing a reset — or using
`POST /users/me/change-password` — also records a *password epoch* in Redis, which
`authenticate()` compares against each access token's `iat`. That is what
invalidates sessions that were already issued, since access tokens are stateless
and revoking the refresh token alone would not have cut them off.

## Branding

The product is **JestBest**, with **JB** used as the monogram in compact spots.

| Asset | File |
| --- | --- |
| Wordmark lockup (mark + "JestBest") | `web/public/logo.svg` |
| Mark / app icon | `web/public/mark.svg` |
| Favicon | `web/public/favicon.svg` |

The mark is a rounded badge split vertically into two tones — light blush
`#FCEAE8` on the left and deep red `#8A2E3A` on the right — with the divide
running through the seam between the two letters. The "J" is drawn in the deep
tone on the light half and the "B" in white on the deep half, so both letters
stay legible (7.1:1 and 8.3:1) rather than blending into their own background.
The letterforms are hand-authored paths rather than `<text>`, so the mark needs
no webfont and renders identically in the browser, in `logo.svg`, and in the
favicon.

The React `<Logo />` component in `web/src/components/Logo.tsx` inlines the
same geometry so the wordmark inherits the surrounding text colour, and
supports `variant="full" | "mark"` plus an optional `showCaption` line. The UI
accent ramp is defined in `web/src/index.css` as `--color-red-500 #F08080`
(interactive accent), `--color-red-600 #D04552` and `--color-red-700 #A63A45`.


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
JestBest/
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
2. **API key** via `x-api-key: jb_…` **plus** `x-org-id`. Keys are stored as
   SHA-256 hashes and only ever displayed once, at creation.
3. **Optional auth** for public endpoints that behave differently when signed in.

Roles are `OWNER`, `ADMIN`, `QA_MANAGER`, `DEVELOPER`, `TESTER`, `VIEWER`, mapped
to granular permissions in [`src/constants/permissions.ts`](src/constants/permissions.ts).

Two details in that mapping are load-bearing:

- **Roles are read from the database on every request**, not trusted from the
  token. Access tokens are stateless and live for 15 minutes, so a role that was
  revoked still appeared to hold its old permissions for that window. Membership
  also filters `deletedAt: null`, so a removed member's token stops working
  immediately.
- **Reading the member list is not an admin action.** `GET
  /organizations/:id/members` was gated behind `ORG_MEMBER_MANAGE`, so developers,
  testers and viewers got a `403` on a page they are meant to be able to open.
  There is now a separate `ORG_MEMBER_READ` granted to every role, while invites,
  role changes and removals still require `ORG_MEMBER_MANAGE`.

Changing a member's role or removing them revokes that user's refresh tokens, so
a demotion takes effect without waiting for token expiry.

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

## Performance

Every paginated list endpoint has the same shape: filter on a tenant/scope
column, optionally filter on a status, then sort `createdAt DESC` and take one
page. A single-column index can find the rows but cannot satisfy the `ORDER BY`,
so Postgres builds a top-N sort over every matching row — the cost grows with
the tenant's history rather than with the page size.

`20261008010000_composite_list_indexes` gives each of those queries an index
whose column order matches the query exactly:

| Endpoint | Query shape | Index |
| --- | --- | --- |
| `GET /bugs` | `WHERE organizationId \| projectId [AND status] ORDER BY createdAt DESC` | `Bug_organizationId_createdAt_idx`, `Bug_projectId_createdAt_idx` |
| `GET /test-runs` | `WHERE projectId [AND status] ORDER BY createdAt DESC` | `TestRun_projectId_createdAt_idx`, `TestRun_status_createdAt_idx` |
| `GET /audit-logs` | `WHERE organizationId [AND resourceType] ORDER BY createdAt DESC` | `AuditLog_organizationId_createdAt_idx` |
| `GET /webhooks/:id/deliveries` | `WHERE webhookId ORDER BY createdAt DESC` | `WebhookDelivery_webhookId_createdAt_idx` |
| `GET /test-cases` | `WHERE projectId ORDER BY createdAt DESC` | `TestCase_projectId_createdAt_idx` |

The seven single-column indexes each composite replaces (`Bug_projectId_idx`,
`TestRun_status_idx`, …) are dropped in the same migration. Every one of them is
a strict leading-column prefix of its replacement, so an equality-only query
still matches the new index — no query loses coverage. Unscoped `createdAt`
indexes stay: they remain the right plan for global recency queries with no
tenant filter.

Measured on 60 000 rows per table in a rolled-back transaction (see the plan
shape; full `EXPLAIN (ANALYZE, BUFFERS)` output reproduced here):

```text
-- bug list, one of 25 tenants, status = OPEN, LIMIT 20
Index Scan Backward using "Bug_organizationId_createdAt_idx"
  Index Cond: ("organizationId" = 'bulko-7')
  Rows Removed by Filter: 2400            -- status filtered from the heap
  Execution Time: 1.423 ms

-- test runs, one project, status = FAILED, LIMIT 20
Index Scan Backward using "TestRun_projectId_createdAt_idx"
  Index Cond: ("projectId" = 'bulkp-7')
  Rows Removed by Filter: 98
  Execution Time: 0.106 ms
```

Both plans walk the index in reverse and stop at `LIMIT`; the buffer counts stay
flat as history grows, because the scan is bounded by the page it returns.
`__tests__/integration/performance/compositeIndexes.test.ts` asserts the index
set so a schema edit that silently drops one of them fails CI.

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

Each integration file truncates `jestbest_test` in `beforeEach`, so **the suites
must run serially** — which is why `npm test` passes `--runInBand`. Running
`npx jest` directly without that flag will produce flaky failures.

`__tests__/fixtures/testApp.ts` provides `request()`, `createTestUser()`, and
`resetDatabase()`, and closes queues/Redis on teardown so Jest can exit.

Current state: **316 tests across 31 suites passing** on the backend and **36
tests across 7 suites** in the SPA (`npm test --prefix web`), last full run.

| Suite | What it covers |
| --- | --- |
| `unit/utils`, `unit/validators` | slug resolution, pagination, JWT, Zod schemas |
| `unit/services/stripeWebhook` | signature verification, tampering, replay window |
| `unit/middleware/errorHandler` | Prisma `P2002`/`P2025` → `409`/`404`, malformed JSON body → `400`, unknown errors logged once and returned as opaque `500` |
| `rbac`, `validation` | permission matrix, validator edge cases |
| `integration/auth` | register → verify → login → refresh → `/users/me`, password change |
| `integration/auth/passwordReset` | purpose-bound + single-use reset tokens, password-epoch session invalidation |
| `integration/organizations` | cross-tenant isolation, membership, role changes |
| `integration/organizations/auditLogs` | audit list pagination caps, tenant scoping |
| `integration/projects` | CRUD, pagination, archiving, dashboard |
| `integration/testCases` | CRUD, duplicate, archive, filters, generation |
| `integration/bugs` | CRUD, status, assignment, comments, filters |
| `integration/testRuns/exactlyOnce` | a run is claimed with an atomic conditional update, so a BullMQ retry cannot execute it twice; cancellation is honoured mid-run |
| `integration/apiKeys` | issue/revoke, hash never exposed, API-key auth |
| `integration/integrations` | connecting to a foreign `projectId` is rejected; GitHub resolution prefers the bug's project |
| `integration/agents` | unimplemented `EXECUTION`/`REPORT_AGENT` return 400, not 500 |
| `integration/applications` | scan-status polling, cross-tenant and wrong-application rejection |
| `integration/auth/oauth` | OAuth exchange-token redemption: single-use, atomic under concurrency, no session for a missing user |
| `integration/webhooks` | signing secret is random and redacted everywhere except create; signature verify/tamper; SSRF targets refused |
| `integration/webhooks/redeliver` | a replay creates a fresh attempt, and an id from another tenant, an unknown id or a switched-off webhook is refused |
| `integration/analytics/flakyTests` | detected flakiness is joined to the caller's own test cases, worst first, and never crosses a tenant boundary |
| `integration/auth/switchOrganization` | the new token pair carries the destination orgId, the presented refresh token is revoked, non-members and revoked members get `403` |
| `integration/organizations/memberAccess` | every role can read the member list; only admins can mutate it |
| `integration/billing/stripeWebhook` | signature over the exact raw bytes, the subscription row is updated before `200`, and a redelivered event id is acknowledged but applied once |
| `integration/errors/prismaErrors` | a duplicate invite surfaces as `409 CONFLICT`, a missing row as `404`, through real routes |
| `integration/health` | liveness vs readiness (`Prisma`, Redis, queue depth), and `503` while the process drains |
| `integration/notifications/slackNotification` | the Slack payload carries the decrypted config, never the stored ciphertext |
| `integration/seeds/demoSeed` | the demo workspace is complete (cases, 2 weeks of runs, bugs, usage) and re-running it adds nothing |
| `integration/performance/compositeIndexes` | the `(scope, createdAt)` index set the list endpoints depend on |

## Frontend notes

The SPA is React + Vite + TypeScript with TanStack Query and Zustand. Routes are
code-split with `React.lazy` (`src/App.tsx`): only the landing page and the
login/register screens load eagerly. Before splitting, the whole product shipped
as one 1.27 MB bundle, so a first-time visitor who only needed the login page
downloaded every feature.

```bash
cd web
npm run dev
npm run typecheck
npm run lint
npm run build
```

The SPA runs Vitest (`npm test --prefix web`, jsdom, setup in
`src/test/setup.ts`). The suites cover the parts where a UI mistake is silent
and expensive: session teardown, pagination-shaped responses, the flaky-test
list, the delivery log's redeliver action, and the workspace switcher (including
that a refused switch leaves the session alone). Pages themselves are covered by
the backend contract tests, since they are thin query + render layers.

A few frontend/backend contracts that were silently broken, and are now aligned:

- **Bug status.** The UI offered `WONT_FIX`, which is not in the Prisma
  `BugStatus` enum, so saving a bug to that state always returned a `400`. The
  equivalent existing state is `REJECTED`. The shared `BugStatus` type is now
  declared as the enum's members so the next drift is a compile error.
- **Bug comments.** The comment author is exposed as `user` (the Prisma
  relation), but the UI read `comment.creator`, so every comment rendered
  "Unknown user".
- **Run duration.** `TestRun.duration` is milliseconds, computed as
  `Date.now() - startedAt`. The formatter treated it as seconds, so a 2.5-second
  run displayed as "2500.00s".
- **Billing usage.** `GET /billing/usage` returns `{ subscription, current,
  history, latest }`, but the settings page expected `testRunsUsed` and
  `testRunLimit` at the top level — which the API never sent, so the panel read
  `0 / 0` for every organization. The page now derives the limit from the plan
  and reads `latest.testsRun`.
- **Analytics quality score and release risk.** The API returns these only when
  `projectId` is supplied; the dashboard never sent one, so both cards silently
  never rendered. The dashboard now has a project selector.
- **Refresh and logout.** A rotated refresh token was not persisted, so the app
  fell back to the previous one. Logout sent no refresh token at all, leaving
  the server-side session valid for the remainder of its 7-day life.

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
npm run seed:demo           # seed roles, admin and a demo workspace (idempotent)

npm run dev --prefix web    # frontend
npm run build --prefix web  # typecheck + production build
npm run lint --prefix web
```

Playwright needs its browser binaries once:

```bash
npx playwright install chromium
```

## Deployment

The runbook — what runs where, how it gets there, and how to explain the
pipeline if someone asks you to walk it through:

- [Architecture](#architecture-1)
- [The images](#the-images)
- [One-time AWS setup](#one-time-aws-setup)
- [What CI does](#what-ci-does)
- [What CD does](#what-cd-does)
- [First deploy, by hand](#first-deploy-by-hand)
- [Day-two operations](#day-two-operations)
- [Environments and secrets](#environments-and-secrets)
- [Hardening checklist](#hardening-checklist)
- [Explaining it in an interview](#explaining-it-in-an-interview)

The short version:

- **Two images.** `Dockerfile` (multi-stage API, migrations run on boot) and
  `web/Dockerfile` (Vite build served by nginx, which also proxies `/api` so the
  browser only ever talks to one origin).
- **Two workflows.** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs
  typecheck/lint/format, all backend tests against real Postgres and Redis, all
  frontend tests, and both image builds on every push and PR.
  [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs after a
  green CI on `main`: build → push to ECR → roll out the host.
- **OIDC, not access keys.** GitHub assumes an IAM role scoped to this
  repository's `main` branch, so no long-lived AWS credential exists anywhere.
- **`docker-compose.prod.yml`** is the production topology: only nginx is
  published; Postgres, Redis and the API are reachable only on the internal
  network.

Split the three workloads when it outgrows a single box — they have very
different resource profiles:

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

### Architecture

```
                        GitHub (main)
                            │  push / PR
                            ▼
                 ┌──────────────────────┐
                 │  CI: lint, typecheck │
                 │  316 backend tests,  │
                 │  36 frontend tests,  │
                 │  both images build   │
                 └──────────┬───────────┘
                            │ green on main
                            ▼
                 ┌──────────────────────┐
                 │  CD: build images,   │
                 │  push to Amazon ECR  │
                 │  (OIDC, no AWS keys) │
                 └──────────┬───────────┘
                            │ SSH (only carries image tags)
                            ▼
   ┌───────────────────────────────────────────────────────────┐
   │  EC2 instance                                             │
   │                                                           │
   │   :80  nginx (image jestbest-web)                         │
   │          ├── /            → React SPA (static)           │
   │          └── /api/*       → proxy → api:4000             │
   │                                                           │
   │   api:4000  (image jestbest-api, internal only)           │
   │          ├── prisma migrate deploy   ← schema before boot│
   │          └── node dist/server.js                         │
   │                                                           │
   │   postgres (pgvector)  ← internal, no published port     │
   │   redis                ← internal, no published port     │
   └───────────────────────────────────────────────────────────┘
```

Design decisions worth being able to justify:

| Decision | Why |
| --- | --- |
| nginx sits in front and proxies `/api` | The browser calls one origin, so CORS never enters the picture. The API container publishes no port at all — a port scan of the host only finds 80. |
| Postgres and Redis publish no ports | The database is reachable only on the compose-internal network. This is the single highest-value hardening step on a single-box deploy. |
| `prisma migrate deploy` runs inside the API container before the server | Schema and application code ship in the same image and move together, so a rollback rolls back both. |
| Images are built in CI and pushed to ECR | The host never runs `npm ci` or a compiler, so a deploy cannot fail because of a dependency or toolchain change on the box. |
| GitHub assumes an AWS IAM role with OIDC | No long-lived AWS access key exists in the repository, in the workflow file, or in build logs. Tokens are short-lived per run. |
| The SPA is built with `VITE_API_URL=/api/v1` | A relative base URL keeps requests same-origin, which is what makes the nginx proxy sufficient. That value is baked in at build time, so it is a build argument, not runtime config. |

### The images

| Image | Dockerfile | Output |
| --- | --- | --- |
| `jestbest-api` | `Dockerfile` (repo root) | Multi-stage: `npm ci` → `prisma generate` → `tsc` build → slim runner with `dist/`, `prisma/` and a non-root user. |
| `jestbest-web` | `web/Dockerfile` | Multi-stage: `npm ci` → `vite build` → `nginx:alpine` with `nginx.conf` (SPA fallback + `/api` proxy). |

Both are reproducible (`npm ci` against the lockfile) and both are small: dev
dependencies, tests and source are never copied into the runner stage.

Browser execution is the one optional extra. Chromium and its OS libraries
roughly double the API image, so it is opt-in:

```bash
docker build --build-arg INSTALL_BROWSERS=1 -t jestbest-api .
```

Without it, everything except real browser test execution works.

### One-time AWS setup

Steps 1–3 are AWS console/CLI work done once. Step 4 is the only recurring
manual thing: the secret files on the host.

**1. A VPC with a public subnet, and an EC2 instance in it.**
`t3.small` is enough to start. Open only port 22 (your IP) and port 80. Install
Docker and the compose plugin on it:

```bash
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2
sudo usermod -aG docker "$USER"   # re-login for it to take effect
```

**2. An ECR repository** for each image:

```bash
aws ecr create-repository --repository-name jestbest-api
aws ecr create-repository --repository-name jestbest-web
```

**3. GitHub OIDC → IAM role.** This is what replaces an access key.

```bash
# Trust GitHub's OIDC provider
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com

# Trust that provider for THIS repo's main branch only
cat > trust.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:whomimohshukla/JestBest:ref:refs/heads/main"
      }
    }
  }]
}
EOF
aws iam create-role --role-name github-actions-jestbest \
  --assume-role-policy-document file://trust.json
aws iam put-role-policy --role-name github-actions-jestbest --policy-name ecr-push \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      { "Effect": "Allow", "Action": ["ecr:GetAuthorizationToken"], "Resource": "*" },
      { "Effect": "Allow", "Action": [
          "ecr:BatchCheckLayerAvailability","ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage","ecr:PutImage","ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart","ecr:CompleteLayerUpload"
        ],
        "Resource": "arn:aws:ecr:REGION:ACCOUNT:repository/jestbest-*" }
    ]
  }'
```

The `sub` condition pins the role to this repository's `main` branch. That
matters: without it, a workflow running in *any* repository on GitHub could
assume your role.

**4. GitHub repository secrets** → Settings → Secrets and variables → Actions:

| Secret | Value |
| --- | --- |
| `AWS_REGION` | e.g. `us-east-1` |
| `AWS_ROLE_ARN` | the role created above |
| `EC2_HOST` | public IP/DNS of the instance |
| `EC2_SSH_USER` | `ubuntu` or `ec2-user` |
| `EC2_SSH_KEY` | private half of the instance key pair |

**5. The host's secret file** — `~/jestbest/.env.prod`, created once by hand and
never committed (`.gitignore` covers every `.env*` except `.env.example`):

```bash
mkdir -p ~/jestbest && cd ~/jestbest
cat > .env.prod <<'EOF'
POSTGRES_USER=jestbest
POSTGRES_PASSWORD=<openssl rand -hex 24>
POSTGRES_DB=jestbest
APP_ORIGIN=https://your-domain.example
JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
ENCRYPTION_KEY=<openssl rand -hex 32>
LOG_LEVEL=info
EMAIL_PROVIDER=log
INSTALL_BROWSERS=0
EOF
chmod 600 .env.prod
```

`ENCRYPTION_KEY` is AES-256-GCM for stored integration credentials. Rotating it
invalidates existing stored integrations, so treat it like a database password.

### What CI does

`.github/workflows/ci.yml`, on every push and pull request:

1. **backend** — starts `pgvector/pgvector:pg16` and `redis:7-alpine` as service
   containers (the same images `docker-compose.yml` uses), runs `npm ci`,
   `prisma generate`, `prisma migrate deploy`, then typecheck, lint, format
   check, `npm test`, and `npm run build`.
2. **frontend** — `npm ci`, typecheck, lint, `npm test` (Vitest), production build.
3. **images** — both Dockerfiles must actually build, so a broken Dockerfile
   fails the PR instead of failing the deploy.

Why the tests run against a real database: the risky behaviour here is tenancy
scoping, refresh-token rotation and Prisma query shape. A mocked Prisma client
proves your mocks work, not your queries.

Concurrency is grouped per ref and cancelled on new pushes, so a superseded PR
does not burn runner minutes.

### What CD does

`.github/workflows/deploy.yml`, triggered by a successful CI run on `main`:

1. Assume the IAM role via OIDC.
2. Build both images and push `:sha` and `:latest` to ECR (layer cache from the
   GitHub Actions cache, so rebuilds are fast).
3. Copy `docker-compose.prod.yml` and `scripts/deploy.sh` to the host over SSH.
4. Run `deploy.sh`, which logs in to ECR, pulls the exact SHA the workflow just
   pushed, and runs `docker compose up -d`.

The concurrency group is `deploy-production` with `cancel-in-progress: false` —
two deploys must never interleave, but an in-flight deploy must not be killed
halfway either.

The SSH step transmits only image tags. Secrets never travel over it: the host
already has its own `.env.prod`.

### First deploy, by hand

Before you turn on CI/CD, prove the topology works:

```bash
# on your machine, with credentials configured
docker build -t 123456789012.dkr.ecr.us-east-1.amazonaws.com/jestbest-api:manual .
docker build -t 123456789012.dkr.ecr.us-east-1.amazonaws.com/jestbest-web:manual ./web
docker push <both tags>

# on the EC2 host
cd ~ && git clone https://github.com/whomimohshukla/JestBest.git
cd JestBest
API_IMAGE=<registry>/jestbest-api:manual \
WEB_IMAGE=<registry>/jestbest-web:manual \
ECR_REGISTRY=<registry> ./scripts/deploy.sh
```

Then check:

```bash
docker compose -f docker-compose.prod.yml ps                    # all healthy
curl -fsS http://<host>/api/v1/health/ready                     # ok
curl -fsS http://<host>/                                         # index.html
docker compose -f docker-compose.prod.yml ps postgres           # no host port
```

### Day-two operations

```bash
# logs
docker compose -f docker-compose.prod.yml logs -f api

# database console
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U jestbest -d jestbest

# roll forward to a SHA that CI already built
API_IMAGE=<registry>/jestbest-api:<sha> WEB_IMAGE=<registry>/jestbest-web:<sha> ./deploy.sh

# migrations, if you ever need to run them out of band
docker compose -f docker-compose.prod.yml exec api npx prisma migrate status
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

Backups: Postgres runs in a named volume. A real backup is a scheduled dump, not
the volume:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U jestbest jestbest | gzip > "backup-$(date +%F).sql.gz"
```

Put that in `cron` on the host and copy the result off the machine.

### Environments and secrets

`.env.example` is the documented template and the only env file committed. The
rest are local/ignored: `.env`, `.env.development`, `.env.staging`,
`.env.production`.

Two classes of secret:

- **Process secrets** (JWT keys, `ENCRYPTION_KEY`, DB password) — live only in
  the host's `.env.prod`. Never in git, never in an image layer, never in CI.
- **Delivery secrets** (GitHub OIDC role, SSH key) — live in GitHub's encrypted
  repository secrets.

Never pass a secret as a `docker build` argument: build args are recorded in the
image history. `VITE_API_URL` and `INSTALL_BROWSERS` are not secrets, which is
why they are build args.

### Hardening checklist

Do these before the instance is reachable by anyone but you:

- [ ] Terminate TLS. Simplest on one box: `certbot` with the nginx plugin, or an
      ALB in front if you prefer.
- [ ] Restrict port 22 to your IP in the security group.
- [ ] Confirm Postgres and Redis have no published port: `ss -lntp` must show
      only 22 and 80.
- [ ] Set `CORS_ORIGINS`/`APP_ORIGIN` to your real origin — never `*` with
      credentials enabled.
- [ ] Verify `.env.prod` is `chmod 600` and not in git: `git status --ignored`.
- [ ] Add disk and memory alarms; an AI QA service can fill a disk with run
      artifacts.
- [ ] Turn on automated security updates (`unattended-upgrades`).

### Explaining it in an interview

A 90-second version you can say from memory:

> "The app is a TypeScript monorepo: an Express API with Prisma and Postgres,
> Redis for BullMQ queues and session state, and a React SPA. Everything ships
> as two Docker images — the API is a multi-stage build that compiles TypeScript
> and runs migrations on boot, and the SPA is built by Vite and served by nginx,
> which also reverse-proxies `/api` so the browser only ever talks to one origin
> and CORS never becomes a problem.
>
> CI runs on every push: typecheck, lint, and the test suites against real
> Postgres and Redis containers, because tenancy and query bugs are exactly what
> mocks hide. On green, CD builds both images, pushes them to ECR, and rolls the
> host out to the new tags.
>
> Two things I was deliberate about. First, AWS authentication is OIDC: GitHub
> assumes a short-lived IAM role scoped to this repo's main branch, so there is
> no long-lived AWS key anywhere. Second, the database and Redis publish no host
> ports — only nginx is reachable — and migrations ride inside the API image so
> schema and code deploy as one unit."

If they dig deeper, the two most common follow-ups and good answers:

**"How do you handle secrets?"**
Three tiers: env files ignored by git and read from a `chmod 600` file on the
host; GitHub Actions repository secrets for delivery (OIDC role ARN, SSH key);
and OIDC so no AWS credential is stored at all. Secrets are never build args
because build args land in image history.

**"What would you do differently at scale?"**
Move Postgres to RDS with automated snapshots, Redis to ElastiCache, the API to
an ECS Fargate service behind an ALB, and the SPA to CloudFront with S3 origin —
the images and the CI/CD contract do not change, only where they run. That path
is a straight lift: the compose file becomes task definitions, and `deploy.sh`
becomes `aws ecs update-service --force-new-deployment`.

**"How do you roll back?"**
Every deploy is an immutable image tag, so rollback is pointing the service at
the previous SHA and letting `prisma migrate deploy` bring the schema to what
that version expects. Down migrations are written deliberately or the release is
reversible by expanding the schema first (add columns, deploy, then remove the
old ones later).

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

**Not implemented:** the AI fix agent's end-to-end PR workflow, and any
infrastructure-as-code layer (Terraform/Kubernetes). CI/CD does exist — GitHub
Actions typechecks, lints, formats, runs the full suite and builds both Docker
images on every push, then `deploy.yml` ships the API image to an EC2 host over
SSH (`scripts/deploy.sh`, `docker-compose.prod.yml`); the `images`/`deploy` jobs
stay red until the repository secrets below are set.

| Secret | Used by |
| --- | --- |
| `AWS_ROLE_ARN`, `AWS_REGION` | OIDC login for the image push |
| `EC2_HOST`, `EC2_SSH_USER`, `EC2_SSH_KEY` | the deploy job |

Integration config is encrypted at rest, but no outbound code-hosting
automation runs in production: nothing opens a pull request on a customer's
behalf.

### Remaining gaps

Stated plainly so the boundary between "shipped" and "not shipped" is not
inferred from the marketing copy:

- **Billing is plan enforcement, not commerce.** `stripeService.createCheckoutSession`
  exists but no route or page calls it, so upgrades go through
  `PATCH /billing/plan` with a real Stripe key required only for webhooks.
- **AWS SES is a stub** (`sendViaSES` throws). SMTP, SendGrid and the log
  provider work; `.env` is configured for Gmail SMTP.
- **Artifacts land in `/tmp`** until `AWS_S3_BUCKET` and AWS credentials are
  set, which is fine locally and not durable on a container host.
- **Updates are polled**, not pushed: there is no WebSocket or SSE channel, so
  a live run page refreshes on an interval.
- **No automated accessibility tests** (no axe, no focus-trap assertions); a
  few landmarks and `aria-label`s are present but the suite does not enforce
  them.

### Delivery guarantees

Three places where "at least once" arrives from the outside and the system has
to make it behave like "exactly once" or "at most once":

- **Stripe webhooks** are verified over the exact raw bytes, deduplicated by
  event id (a concurrent redelivery loses the insert race and is acknowledged
  without re-applying), and applied *synchronously* — the subscription row is
  updated before the `200`. A failure inside the handler propagates, so the
  response is a `5xx` and Stripe retries rather than the update being lost.
- **Test runs** are claimed with an atomic conditional update
  (`status: PENDING`, or `RUNNING` past a stale-claim threshold) before a worker
  executes anything, so a BullMQ retry or a second worker cannot run the same
  case list twice. Finalisation is guarded the same way on `status: RUNNING`.
- **Process shutdown** flips readiness to `503` first, waits for in-flight
  requests, then closes workers and connections. `/health/live` answers "the
  process is up"; `/health/ready` answers "I can serve traffic" (database,
  Redis, queue depth) and is the endpoint a load balancer should poll.

### Demo data

`npm run seed:demo` (or `SEED_DEMO_DATA=1 npm run prisma:seed`) adds a project,
five test cases, eight runs spread over two weeks, a bug backlog and three
months of usage rows, so a fresh install renders a populated dashboard instead
of empty charts. It is idempotent — re-running against the same database adds
nothing — which is what makes it safe on an existing environment.

### Agent types

`POST /agents/trigger` accepts only the types the orchestrator can actually run:

`EXPLORER`, `TEST_GENERATOR`, `FAILURE_ANALYZER`, `BUG_AGENT`, `HEALING_AGENT`,
`CODE_AGENT`, `FIX_AGENT`.

The Prisma `AgentType` enum is a superset — `EXECUTION` and `REPORT_AGENT` are
reserved placeholders with no graph node. Sending one now fails validation with a
`400` (`src/constants/agents.ts` owns the supported set) instead of failing inside
the state graph with a `500`. The orchestrator guards the same set, so an internal
caller cannot reintroduce the crash.

### Integration scoping

An integration is either org-wide or attached to a single project. Connecting one
against a `projectId` you do not own is rejected with `403`; the bug → GitHub
mirror resolves the integration for the **bug's own project** first and only then
falls back to the org-wide default, so a bug from project A can never be filed
into project B's repository.

### Scanning an application

`POST /applications/:applicationId/scan` starts an asynchronous scan and returns a
`scanId`. Poll it with:

```text
GET /applications/:applicationId/scan/:scanId
```

It requires `APPLICATION_SCAN` and re-checks that the application belongs to the
caller's organization, so a scan id from another tenant returns `403` and a scan
that belongs to a different application returns `404`.


### OAuth sign-in flow

OAuth is a three-leg redirect, and the provider `code` is only usable by the
server that holds the client secret — it is single-use and cannot be redeemed by
the browser. The flow therefore splits the exchange:

1. `GET /auth/oauth/:provider/authorize` generates a random state, stores it in
   Redis for 10 minutes, and redirects to the provider.
2. GitHub returns to `GET /auth/oauth/:provider/callback` on **the API**. The
   callback consumes the state with an atomic `GETDEL`, exchanges the code, and
   redirects the browser to
   `${APP_ORIGIN}/auth/oauth/callback?provider=…&exchange=<token>`.
3. The SPA calls `POST /auth/oauth/exchange` with that token. Redemption is an
   atomic `GETDEL` too, so the token works exactly once and two concurrent
   redemptions cannot both succeed (there is a test for exactly that race).

Configuring `GITHUB_OAUTH_CALLBACK_URL` (and `GOOGLE_OAUTH_CALLBACK_URL`) is
the part that most often breaks this: each must point at the API's callback
route, not at the SPA. A `/integrations/github/callback` path existed in
`.env.example` and matched no route at all, so sign-in could never complete.
`API_ORIGIN` provides the correct default
(`${API_ORIGIN}${API_PREFIX}/auth/oauth/github/callback`, and the Google
equivalent). GitHub and Google are the two providers wired into sign-in
(`github` + `google`); the same callback serves both, and an OAuth login
upserts a user by email, so an unknown email **registers** the account (sign-in
and sign-up share one flow).

The callback **requires** the state: a missing one fails with `missing_state`
and an unknown/consumed one with `invalid_state`, both surfaced as an OAuth
error the SPA turns into a message instead of a silent sign-in failure. The
state is bound to a Redis entry rather than to the initiating browser session,
so binding it to a cookie (or adopting PKCE) is the next tightening.

### Webhook signing secrets

`POST /webhooks` generates a 32-byte random secret when you do not supply one.
It is returned **only** in the create response; list, get and update redact it,
because it is the HMAC key a customer's systems trust. The UI surfaces it in a
one-time dialog, since a generated secret that is never displayed cannot be
configured on the receiving end.

Previously the secret was `HMAC-SHA256(organizationId)`. The organization id is
not secret — it appears in API responses and URLs — so anyone who knew an org's
id could recompute its signing key and forge webhook deliveries that the
customer's own endpoint would accept as genuine.

Outbound delivery goes through `safeFetch`, which resolves the hostname and
refuses loopback, link-local, private and cloud-metadata addresses, caps
redirects, and bounds the response. It is applied at creation and update time so
an internal target is rejected immediately rather than becoming a permanent
delivery failure.
