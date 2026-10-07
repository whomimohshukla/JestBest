# Deploying JestBest on AWS

This document is the runbook: what runs where, how it gets there, and how to
explain it if someone asks you to walk through the pipeline.

- [1. Architecture](#1-architecture)
- [2. The images](#2-the-images)
- [3. One-time AWS setup](#3-one-time-aws-setup)
- [4. What CI does](#4-what-ci-does)
- [5. What CD does](#5-what-cd-does)
- [6. First deploy, by hand](#6-first-deploy-by-hand)
- [7. Day-two operations](#7-day-two-operations)
- [8. Environments and secrets](#8-environments-and-secrets)
- [9. Hardening checklist](#9-hardening-checklist)
- [10. Explaining it in an interview](#10-explaining-it-in-an-interview)

---

## 1. Architecture

```
                        GitHub (main)
                            │  push / PR
                            ▼
                 ┌──────────────────────┐
                 │  CI: lint, typecheck │
                 │  252 backend tests,  │
                 │  22 frontend tests,  │
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

## 2. The images

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

## 3. One-time AWS setup

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
        "token.actions.githubusercontent.com:sub": "repo:whomimohshukla/VeriBot:ref:refs/heads/main"
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

## 4. What CI does

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

## 5. What CD does

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

## 6. First deploy, by hand

Before you turn on CI/CD, prove the topology works:

```bash
# on your machine, with credentials configured
docker build -t 123456789012.dkr.ecr.us-east-1.amazonaws.com/jestbest-api:manual .
docker build -t 123456789012.dkr.ecr.us-east-1.amazonaws.com/jestbest-web:manual ./web
docker push <both tags>

# on the EC2 host
cd ~ && git clone https://github.com/whomimohshukla/VeriBot.git
cd VeriBot
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

## 7. Day-two operations

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

## 8. Environments and secrets

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

## 9. Hardening checklist

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

## 10. Explaining it in an interview

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
