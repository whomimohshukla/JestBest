# JestBest — Manual Testing Guide

A click-by-click walkthrough of every feature, in the order that tells the best
story. Use it to verify a build or to demo the product in an interview.

## 0. Start the app

```bash
# Terminal 1 — API (needs Neon DATABASE_URL + Redis in .env)
cd /path/to/VeriBot
npm run dev                 # http://localhost:4000

# Terminal 2 — Web
cd web
npm run dev                 # http://localhost:5173
```

Seed the demo workspace once (creates the project, cases, runs, bugs and charts):

```bash
cd /path/to/VeriBot
npx prisma migrate deploy
npx prisma db seed          # roles/permissions + demo admin
npm run seed:demo           # the "Acme Storefront" history (idempotent)
```

**Demo login** (from the seed defaults):
`demo@jestbest.dev` / `DemoPassword123!`

Environment notes for the demo:
- `AI_PROVIDER=mock` — AI features return canned data, no key needed.
- `EMAIL_PROVIDER=smtp` (or `log`) — reset/verify mails go to your SMTP, or to
  `.dev-mailbox.log` when set to `log`.
- Real browser execution needs Playwright browsers; the API, UI, webhooks and all
  non-browser flows work without them.

## 1. Project scoping (read this first)

Test Cases, Test Suites and Test Runs are **scoped to a project**. The app now
remembers the last project you picked and **auto-selects it when the workspace
has exactly one project** (the demo has one: *Acme Storefront*). So these pages
populate without you re-selecting every time. To switch, use the
**Filter by Project** dropdown; the choice is kept across pages and in the URL
(`?projectId=…`).

## 2. Global chrome (every page)

| Element | Where | Try |
| --- | --- | --- |
| Sidebar nav | Left | Dashboard, Projects, Apps, Test Cases, Test Suites, Test Runs, Bugs, Analytics, AI Agents, Integrations, Settings |
| Workspace switcher | Top bar | Switch organization; session reloads for that org |
| Profile menu | Top right | Profile, Settings, Sign out |
| Toasts | Corner popups | Appear on every create/update/delete; hover pauses the auto-dismiss |
| Confirm dialog | Modal | Delete actions ask first (no native `window.confirm`) |
| Offline banner | Top | Stop the API and watch it report the backend as offline |

## 3. Feature walkthrough

### 3.1 Auth
1. **Landing** `/` → **Get started** / **Sign in**.
2. **Register** `/auth/register` → fill name/email/password → create account.
3. **Login** `/auth/login` → `demo@jestbest.dev` / `DemoPassword123!`.
4. **Forgot password** `/auth/forgot-password` → enter e-mail → check SMTP inbox
   or `.dev-mailbox.log` for the reset link → `/auth/reset-password`.
5. **Verify email** `/auth/verify-email` (token from the mail).
6. **OAuth** — buttons show **GitHub** and **Google**; they only complete if the
   matching `*_CLIENT_ID/SECRET` and callback URLs are configured.

### 3.2 Dashboard — `/dashboard`
Headline cards (**Quality Score**, **Release Risk**), **Recent Test Runs** and
**Projects** summary. Use **Refresh** to re-pull; **Try again** on error. The
demo seed makes every chart non-zero.

### 3.3 Projects — `/projects`
- **Create Project** (e.g. "Checkout Revamp") → opens project detail.
- Search `Search projects...`.
- **Project Detail** `/projects/:id` — overview, test coverage and quick links
  into test cases/runs. **Archive** a project from the list.

### 3.4 Applications — `/applications`
- **Add Application** — name, `https://…` base URL, description.
- **Scan** an application to discover pages/components (mock/instant).

### 3.5 Test Cases — `/tests`
- Filter by project (auto-selected).
- **New Test Case** — title, description, type, priority, steps, expected result.
- **Generate with AI** — pick project + application, paste requirements, choose a
  count → generates draft cases (`AI_PROVIDER=mock` returns fixtures).
- Edit / **Delete** a case; bulk actions in the table.

### 3.6 Test Suites — `/test-suites`
- **New Test Suite** for the selected project.
- Open a suite → add cases from the dropdown, remove cases, reorder.
- **Run** the suite → starts a run and jumps to its detail page.

### 3.7 Test Runs — `/runs`
- **New Run** — pick project, tick test cases, **Create Run**.
- Run list shows status; active runs **poll** until they settle.
- **Run Detail** `/runs/:id` — the **Run Console** streams per-test results and
  logs (no browser binary required for the non-browser paths).

### 3.8 Bugs — `/bugs`
- **New Bug** — title, description, severity, priority (P0–P3), link a test case.
- Search `Search bugs by title...`; filter by status.
- **Bug Detail** `/bugs/:id` — change status through the workflow, **Add a
  comment...**, **Delete**.

### 3.9 Analytics — `/analytics`
Trend charts (pass rate, duration, volume) and the **Flaky Tests** list (ranked
by flakiness score from run history).

### 3.10 AI Agents — `/agents`
Pick an agent — **Explorer**, **Test Generator**, **Failure Analyzer**,
**Bug Agent** — and run it. Runs, messages and tool calls are recorded. With
`AI_PROVIDER=mock` the agents complete deterministically.

### 3.11 Integrations — `/integrations`
**Connect** GitHub / Jira / Slack (toggles and status). OAuth-based providers
need their client credentials.

### 3.12 Settings — `/settings`
Sidebar tabs: **Profile, Organization, Members, Integrations, Webhooks, API Keys,
Billing, Notifications**.
- **Profile** — name/avatar/password.
- **Organization** — name/slug.
- **Members** — **Invite** teammates, change roles, remove members.
- **Webhooks** — **New Webhook**, then open the delivery log and **Redeliver** a
  failed delivery to verify retries.
- **API Keys** — **Create API Key** (copy it; it is shown once), revoke.
- **Billing** — current plan, usage charts (seeded for 3 months).
- **Notifications** — **Save preferences**.

## 4. 5-minute smoke checklist

- [ ] Login with the demo account lands on `/dashboard` with populated charts.
- [ ] `/tests`, `/test-suites`, `/runs` load **without** manually picking a project.
- [ ] Create a project → it appears in the list and in the testing filters.
- [ ] Create a test case, add it to a suite, run the suite, open the run detail.
- [ ] File a bug, comment on it, advance its status.
- [ ] Analytics shows trends + flaky list.
- [ ] Settings → Webhooks: redeliver a delivery.
- [ ] Sign out returns to the landing page; protected routes redirect to login.
