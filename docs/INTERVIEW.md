# Interview notes — JestBest

What this repository is, what was hard about it, and how to talk about it.
Everything below is verifiable in the code; file references are exact so you can
open them mid-conversation.

---

## 1. The 90-second pitch

JestBest is a multi-tenant QA automation platform: you record or describe a
flow, it generates Playwright tests, runs them on a schedule, tracks flakiness
and failures, mirrors failures into GitHub/Jira, and pushes events to webhooks.

Stack: **modular monolith** — Express + Prisma + PostgreSQL (pgvector for the
failure knowledge base) + Redis/BullMQ on the backend, React + Vite +
TanStack Query + Zustand on the frontend, Docker images and a GitHub Actions
pipeline that typechecks, lints, formats, runs **316 backend tests across 31
suites** and **36 frontend tests across 7 suites**, builds both images and
deploys over SSH.

The story worth telling is not the feature count — it is that the interesting
parts are *distributed-systems-shaped* problems living inside a CRUD app:
exactly-once job execution, webhook idempotency, tenant isolation enforced in
several places, SSRF on user-chosen URLs, and session rotation across
workspaces.

---

## 2. Architecture decisions (with the trade-off)

| Decision | Why | What it costs |
| --- | --- | --- |
| Modular monolith, not microservices | One deployable, one database, transactions stay local; tenancy bugs surface in one place | Teams must respect module boundaries — enforced by folder structure and by services never importing each other's controllers |
| JWT access (15 m) + rotating refresh (7 d) in Redis | Stateless reads, revocable sessions; rotation means a stolen refresh token dies on first use | Needs a Redis round-trip on refresh and a blacklist for logout |
| Multi-tenancy = `orgId` claim + middleware + Prisma `where` | Every request is scoped by a claim re-verified at the edge (`src/middleware/auth.ts:111`) | No database-level guarantee (Postgres RLS would add one) — that is a stated gap, not an oversight |
| BullMQ for async work | Retries, backoff, visibility for the run pipeline and webhook delivery | Retries mean every consumer must be idempotent — see §3 |
| Real Postgres/Redis in tests, no mocked Prisma | Tenancy and transaction bugs are exactly what mocks hide | Suites must run `--runInBand`; ~4.5 min full run |
| Zod at the route boundary, Prisma types inside | Input is untrusted exactly once, at the edge | Two schemas to keep aligned (validators + Prisma) |

---

## 3. The five problems to be ready to draw on a whiteboard

### 3.1 Exactly-once test execution
BullMQ redelivers. Two workers, or one retry after a transient failure, would
run the same case list twice and bill usage twice.

Fix: an atomic compare-and-set claim before any work —
`src/services/test/testExecutionService.ts:41` does
`updateMany({ where: { id, status: PENDING } , data: { status: RUNNING } })`;
`count === 0` means someone else won, so the job exits. Finalisation is guarded
the same way on `RUNNING`, plus a stale-claim threshold so a crashed worker's
run can be taken over. Test: `__tests__/integration/testRuns/exactlyOnce.test.ts`.

*Say:* "the claim is a conditional update, not a read-then-write, because the
race is the whole point."

### 3.2 Stripe webhooks: exactly-once, at-least-once from the outside
Three separate mechanisms, each answering a different failure:
1. **Signature over raw bytes** — `req.rawBody` is retained so re-serialising
   the parsed JSON cannot break the HMAC.
2. **Dedupe by event id** — insert into `stripeWebhookEvent` first
   (`src/services/billing/billingService.ts:107`); the loser of a concurrent
   race catches `P2002` and is acknowledged without applying.
3. **Apply synchronously, propagate errors** — the subscription row is updated
   *before* the `200`, and a handler failure returns `5xx` so Stripe retries
   instead of the update being silently lost.

### 3.3 SSRF: webhooks point at attacker-chosen URLs
`src/utils/safeFetch.ts:128` plus the CIDR table at line 15: only http/https,
DNS resolved first and every answer checked against private/loopback/link-local
ranges (including `169.254.169.254`), embedded credentials refused, redirects
not followed. Create/update paths validate the URL too, so you cannot park a
benign URL and retarget it later.

### 3.4 Tenant isolation
Defence in depth, because one place is never enough:
- `orgId` from the verified token, not from the body (`src/middleware/auth.ts:112`).
- Ownership checked *before* an id is used in a query — the flaky endpoint used
  to pass `projectId` straight through; now it 404s on a foreign project
  (`src/controllers/analytics/getFlakyTests.ts`).
- Webhook deliveries are resolved **through the authorized webhook**
  (`src/services/webhook/webhookService.ts:158`), so a guessed delivery id can
  neither read nor fire another tenant's endpoint.
- List queries are scoped by `(scope, createdAt)` indexes
  (`prisma/migrations/20261008010000_composite_list_indexes/`), and EXPLAIN was
  captured on 60k rows / 25 tenants: `Bug_organizationId_createdAt_idx` ≈ **1.4 ms**.

### 3.5 Sessions across workspaces
The access token *is* the tenant boundary, so "switch workspace" means
re-verify membership, mint a new pair bound to the target org, revoke the
refresh token the caller presented, and clear the entire frontend query cache
(`web/src/components/WorkspaceSwitcher.tsx`) — every cached key was resolved
against the previous tenant. `src/services/auth/authService.ts:292` +
`__tests__/integration/auth/switchOrganization.test.ts`.

---

## 4. Frontend problems worth mentioning

- **Silent contract drift.** The UI offered `WONT_FIX`, which is not in the
  Prisma enum — every save 400'd. The shared type now mirrors the enum so the
  next drift is a compile error. Same class of bug: comment authors read
  `creator` instead of `user` (rendered "Unknown user"), run duration treated
  ms as seconds, billing usage read fields the API never sent.
- **Session teardown.** Clearing only the two token keys left a persisted
  auth record that rehydrated as "signed in" while every request 401'd, and the
  missing-refresh-token path threw before it could redirect.
  `clearAuthSession()` in `web/src/store/authStore.ts` is now the only teardown.
- **Bundle.** The whole product shipped as one 1.27 MB chunk; routes are
  `React.lazy` now (`web/src/App.tsx`), so login loads eagerly and
  `AnalyticsPage` (recharts) is 376 kB gzip 108 kB and only fetched on demand.
- **API response shapes.** `GET /webhooks/:id/deliveries` is paginated — reading
  it as a bare array made `.length` undefined and the table always rendered
  "No deliveries yet".

---

## 5. Testing philosophy (expect to defend it)

- **Real Postgres and Redis in integration tests.** No mocked Prisma: tenancy,
  transactions and query mistakes are precisely what mocks hide.
- **`--runInBand` is mandatory** — each file truncates `jestbest_test` in
  `beforeEach`. Running `npx jest` bare produces the flaky failures you would
  then be tempted to "fix" with retries.
- **Fixtures mirror production paths**: `createTestUser()` registers, verifies
  the email and logs in, so tests exercise the same tokens a real client gets.
- **Every security fix ships with a regression test** that fails on the old
  behaviour — e.g. the flaky suite asserts another tenant's records never appear.
- Frontend: Vitest + jsdom, component tests only where a UI mistake is silent
  and expensive (session teardown, paginated shapes, redeliver, workspace switch).

Numbers: **316 / 31** backend, **36 / 7** frontend, full gate =
`typecheck + lint + format:check + jest --runInBand` and
`typecheck + lint + test + build` for the SPA.

---

## 6. Security checklist (recite from memory)

1. Access 15 m / refresh 7 d, refresh **rotated** and stored by `jti` in Redis;
   logout blacklists the access token and revokes the refresh token.
2. Password reset tokens are purpose-bound and single-use; a password change
   bumps an epoch that invalidates outstanding sessions.
3. RBAC: role → permission matrix (`src/constants/roles.ts`), enforced per route
   with `requirePermission`.
4. Rate limits: 1000/min general, 20 per 15 min on auth endpoints.
5. Integration config encrypted at rest with **AES-256-GCM** (`src/utils/encryption.ts`).
6. Secrets never serialised: webhook signing secrets are redacted from every
   read path; Slack config is decrypted only inside the payload builder.
7. OAuth requires `state`; missing/expired state fails closed with
   `missing_state` / `invalid_state` (`src/controllers/auth/oauthCallback.ts:76`).
8. SSRF guard on every outbound request to a user-supplied URL.
9. Webhook payloads HMAC-signed; Stripe verified over raw bytes.
10. Audit trail on authentication and organisation mutations.
11. Zod validation on every route body/query/params.
12. Errors: Prisma `P2002` → 409, `P2025` → 404, malformed JSON → 400,
    unknown → logged once and returned as an opaque 500
    (`src/middleware/errorHandler.ts:47`).

---

## 7. Honest gaps — say them before you are asked

- No checkout page: `createCheckoutSession` exists but no route calls it.
- `sendViaSES` throws (SMTP/SendGrid/log providers work; local `.env` uses Gmail SMTP).
- Screenshots/artifacts go to `/tmp` until `AWS_S3_BUCKET` is configured.
- Updates are polled; no WebSocket/SSE.
- No automated accessibility tests (no axe, no focus-trap assertions).
- CI `images`/`deploy` jobs are red until repo secrets
  (`AWS_ROLE_ARN`, `AWS_REGION`, `EC2_HOST`, `EC2_SSH_USER`, `EC2_SSH_KEY`) are set.
- No Postgres RLS — tenancy is application-enforced.
- Local dev machine has no pgvector, so migrations are hand-written and applied
  with `prisma migrate deploy`; CI uses `pgvector/pgvector:pg16`.

Leading with the gaps reads as ownership. Trailing with them reads as surprise.

---

## 8. Likely follow-ups and short answers

**"How would you add realtime run status?"** An SSE endpoint per run (or per
org) fed by the BullMQ job's progress events; the client already polls on an
interval, so the query layer changes shape, not the components. WebSocket if it
has to be bidirectional.

**"How would you scale this?"** It is already horizontally safe (stateless
except Postgres/Redis); workers run as a separate process so browser automation
never competes with request handling. Next levers: read replicas for analytics,
per-org rate limits, and moving list endpoints to keyset pagination.

**"Why Zustand + TanStack Query?"** Query owns server state (cache, invalidation,
dedupe); Zustand owns the session. Mixing them is how you end up with two
sources of truth for the same token.

**"Where would you add RLS?"** As a second line of defence under the existing
middleware: set `app.current_org` per transaction from the verified claim. It
does not replace application scoping — Prisma would still need the predicate.

**"How do you avoid N+1?"** Prisma `select`/`include` projections, aggregate
counts via `_count`, and composite indexes so the paginated scan is index-only.

**"What would you do differently?"** The flaky endpoint shipped with a raw
`projectId` pass-through; the fix (verify ownership, then use it) should have
been part of the original review. The lesson I generalised: never let a client
id reach a query without an ownership predicate in the same line of code.

---

## 9. Cheat sheet — open these if asked to show, not tell

| Claim | Open |
| --- | --- |
| Atomic run claim | `src/services/test/testExecutionService.ts:41` |
| Stripe dedupe + sync apply | `src/services/billing/billingService.ts:107` |
| SSRF ranges | `src/utils/safeFetch.ts:15` |
| Delivery resolved through the webhook | `src/services/webhook/webhookService.ts:158` |
| Flaky endpoint tenant check | `src/controllers/analytics/getFlakyTests.ts` |
| Workspace switch | `src/services/auth/authService.ts:292` |
| Composite indexes | `prisma/migrations/20261008010000_composite_list_indexes/migration.sql` |
| Prisma error mapping | `src/middleware/errorHandler.ts:47` |
| Session teardown | `web/src/store/authStore.ts` |
| Route-level code splitting | `web/src/App.tsx` |
| Exactly-once tests | `__tests__/integration/testRuns/exactlyOnce.test.ts` |
| Tenant isolation tests | `__tests__/integration/analytics/flakyTests.test.ts` |
