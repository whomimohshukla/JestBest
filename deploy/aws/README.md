# Deploying JestBest for free (AWS EC2 + Vercel + Neon)

A durable-but-free topology for a portfolio/resume demo with **no paying users**:

```
                     ┌─────────────────────┐
   Browser ──HTTPS──▶│  Vercel (static SPA) │   free forever
                     │  web/  (React + Vite)│
                     └──────────┬──────────┘
                                │ HTTPS + CORS
                     ┌──────────▼──────────┐
                     │ AWS EC2 t3.micro    │   free tier (12 months)
                     │  Caddy ─▶ api:4000  │
                     │        └▶ redis     │   (containers)
                     └──────────┬──────────┘
                                │ TLS
                     ┌──────────▼──────────┐
                     │ Neon Postgres       │   free tier
                     └─────────────────────┘
```

- **Frontend** → Vercel (free, no expiry).
- **API + Redis** → one `t3.micro` EC2 instance running Docker Compose.
- **Database** → Neon (already configured).
- **HTTPS** → Caddy with a free `<ip>.sslip.io` hostname + Let's Encrypt (no domain needed).

> ### ⚠️ Cost reality check
> AWS's free tier for EC2 (`t3.micro`, 750 hrs/month) lasts **12 months from account
> creation**, after which the instance bills roughly **$8–10/month**. There is no way
> to make AWS "guaranteed free forever". Follow the **Billing safety** section and the
> instance is ₹0 during the 12 months. Stop/terminate it before the window ends.
> If you want truly-zero-risk, deploy the API to **Render free** instead and skip AWS.

---

## 0. Prerequisites

- AWS account (free tier).
- Neon database (already created; `DATABASE_URL` is in your local `.env`).
- Vercel account (sign in with GitHub).
- This repo pushed to `main` (it is: `github.com/whomimohshukla/JestBest`).

## 1. Prepare Neon (run once from your laptop)

The schema must match the code before the API boots:

```bash
cd /path/to/VeriBot
npx prisma migrate deploy      # applies the 8 migrations
npx prisma db seed             # seeds roles/permissions/admin
```

## 2. Launch the EC2 instance

In the AWS Console → EC2 → **Launch instance**:

| Setting | Value |
| --- | --- |
| Name | `jestbest-api` |
| AMI | Amazon Linux 2023 (free tier eligible) |
| Instance type | **t3.micro** (or t2.micro) |
| Key pair | create/download one (you need it to SSH) |
| Security group inbound | `22` (your IP), `80` (0.0.0.0/0), `443` (0.0.0.0/0) |
| Storage | 30 GB gp3 (free tier max) |

Under **Advanced → User data**, paste the entire contents of `deploy/aws/user-data.sh`.
It installs Docker + Compose, adds 2 GB swap (needed to build on 1 GB RAM), and clones
the repo to `/opt/jestbest`.

After it finishes (~2–3 min), find the instance's **Public IPv4 address**, then:

```bash
ssh -i your-key.pem ec2-user@<PUBLIC_IP>
```

## 3. Configure the environment

```bash
cd /opt/jestbest/deploy/aws
cp .env.example .env
nano .env
```

Fill in:

- `API_DOMAIN` = the public IP with dots replaced by dashes, e.g. `203-0-113-10.sslip.io`.
- `DATABASE_URL` = your Neon pooled URL (add `?sslmode=require`).
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY` = `openssl rand -hex 32` each.
- `APP_ORIGIN` / `FRONTEND_ORIGIN` / `CORS_ORIGINS` / `API_ORIGIN` — set these **after**
  Vercel gives you the URL (step 5); you can start with placeholders and restart later.

## 4. Start the stack

```bash
sudo docker compose up -d --build
sudo docker compose logs -f api      # Ctrl-C to stop following
```

Verify:

```bash
curl https://<API_DOMAIN>/api/v1/health
# {"success":true,"data":{"status":"up",...}}
```

Open `https://<API_DOMAIN>/api/v1/health` in a browser too — the padlock confirms
Let's Encrypt issued the certificate.

## 5. Deploy the frontend to Vercel

1. Vercel → **New Project** → import `whomimohshukla/JestBest`.
2. **Root Directory** = `web`.
3. Framework preset: **Vite** (auto-detected). Build `npm run build`, output `dist`.
4. **Environment Variable** (Production):
   `VITE_API_URL = https://<API_DOMAIN>/api/v1`
5. Deploy. Note the URL, e.g. `https://jestbest.vercel.app`.

`web/vercel.json` already handles SPA routing (deep links fall back to `index.html`).

## 6. Wire CORS and OAuth

Back on the instance, edit `.env` so the API trusts the Vercel origin, then restart:

```bash
cd /opt/jestbest/deploy/aws
nano .env       # APP_ORIGIN, FRONTEND_ORIGIN, CORS_ORIGINS, API_ORIGIN
sudo docker compose up -d
```

For OAuth, register the callback URLs in the provider consoles:

- GitHub: `https://<API_DOMAIN>/api/v1/auth/oauth/github/callback`
- Google: `https://<API_DOMAIN>/api/v1/auth/oauth/google/callback`

Then set `GITHUB_*` / `GOOGLE_*` in `.env` and `docker compose up -d` again.

## 7. Updating the app

From your laptop: commit and push to `main`. On the instance:

```bash
bash /opt/jestbest/deploy/aws/deploy.sh
```

---

## Billing safety (do these now)

1. **AWS Budgets alarm** — Console → Billing → Budgets → create a *Zero-spend* budget
   with an alert at `$0.01` and `$1`, emailed to you. You'll know the instant anything bills.
2. **Use only EC2 + its 30 GB EBS** for this project. Do not create NAT gateways,
   load balancers, RDS, or an unattached Elastic IP (all can bill).
3. **Stop the instance when you're not showing it** (Console → Instance state → Stop).
   Stopped instances don't bill compute; the 30 GB EBS stays within free tier.
4. **Set a calendar reminder ~11 months out** to stop/terminate the instance, or the
   12-month free window ends and it starts billing.
5. Check Billing → **Free Tier** page monthly to confirm you're still inside limits.

## Teardown

```bash
sudo docker compose down          # stop containers
```

Then in the console **terminate** the instance and delete its EBS volume/snapshot to be
sure nothing remains. Neon and Vercel stay free regardless.
