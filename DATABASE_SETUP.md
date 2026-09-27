# JestBest Database Setup Guide

## Issue
The application can't connect to PostgreSQL at `localhost:5432`.

## ✅ Fixed
Changed `.env` file from port `5433` → `5432` to match docker-compose.

## 🐳 Option 1: Using Docker (Recommended)

### Step 1: Start Docker
Make sure Docker Desktop is running on your system.

### Step 2: Start Database Services
```bash
cd /home/whomimohshukla/Desktop/JestBest
docker compose up -d postgres redis
```

### Step 3: Wait for Services to be Ready
```bash
docker compose ps
```

You should see both `jestbest-postgres` and `jestbest-redis` as "running (healthy)".

### Step 4: Run Database Migrations
```bash
npm run prisma:migrate
```

### Step 5: Start the Application
```bash
npm run dev
```

---

## 🔧 Option 2: Using Local PostgreSQL

If you prefer to use a locally installed PostgreSQL instead of Docker:

### Step 1: Install PostgreSQL
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Step 2: Create Database and User
```bash
# Switch to postgres user
sudo -u postgres psql

# Inside psql prompt, run:
CREATE DATABASE jestbest;
CREATE USER jestbest WITH PASSWORD 'jestbest';
GRANT ALL PRIVILEGES ON DATABASE jestbest TO jestbest;
ALTER DATABASE jestbest OWNER TO jestbest;
\q
```

### Step 3: Install pgvector Extension
```bash
sudo -u postgres psql -d jestbest

# Inside psql:
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

### Step 4: Update .env (if using different port)
If your PostgreSQL is on a different port (e.g., 5433), update:
```env
DATABASE_URL=postgresql://jestbest:jestbest@localhost:5433/jestbest?schema=public
```

### Step 5: Install Redis
```bash
# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### Step 6: Run Migrations
```bash
npm run prisma:migrate
```

### Step 7: Start the Application
```bash
npm run dev
```

---

## 🚀 Quick Start (Docker - Easiest)

If Docker Desktop is installed and running:

```bash
# 1. Start services
docker compose up -d postgres redis

# 2. Wait 10 seconds for database to initialize
sleep 10

# 3. Run migrations
npm run prisma:migrate

# 4. Start the app
npm run dev
```

---

## ✅ Verify Connection

Once the app starts, you should see:
```
[INFO] JestBest API listening
  port: 4000
  nodeEnv: "development"
```

Test the health endpoint:
```bash
curl http://localhost:4000/api/v1/health/live
```

---

## 📊 Database Status Commands

### Check Docker containers
```bash
docker compose ps
```

### View logs
```bash
# PostgreSQL logs
docker compose logs postgres

# Redis logs
docker compose logs redis

# App logs
docker compose logs api
```

### Stop services
```bash
docker compose down
```

### Stop and remove data
```bash
docker compose down -v
```

---

## 🐛 Troubleshooting

### "Docker daemon not running"
**Solution:** Start Docker Desktop application

### "Port 5432 already in use"
**Solution:** 
1. Check if PostgreSQL is already running locally:
```bash
sudo systemctl status postgresql
```

2. Either stop local PostgreSQL:
```bash
sudo systemctl stop postgresql
```

3. Or change docker-compose port:
```yaml
postgres:
  ports:
    - '5433:5432'  # Map to different port
```

And update `.env`:
```env
DATABASE_URL=postgresql://jestbest:jestbest@localhost:5433/jestbest?schema=public
```

### "Port 6379 already in use"
**Solution:**
```bash
# Stop local Redis
sudo systemctl stop redis-server

# Or change docker-compose port
redis:
  ports:
    - '6380:6379'
```

And update `.env`:
```env
REDIS_URL=redis://localhost:6380
```

### "Connection refused"
**Solution:**
1. Check services are running:
```bash
docker compose ps
```

2. Check health status:
```bash
docker compose exec postgres pg_isready -U jestbest
```

3. Restart services:
```bash
docker compose restart postgres redis
```

### "Migrations failed"
**Solution:**
```bash
# Reset database
docker compose down -v
docker compose up -d postgres redis
sleep 10
npm run prisma:migrate
```

---

## 📝 Environment Variables

Current configuration in `.env`:

```env
# Database
DATABASE_URL=postgresql://jestbest:jestbest@localhost:5432/jestbest?schema=public

# Redis
REDIS_URL=redis://localhost:6379
```

These match the docker-compose services perfectly!

---

## 🎯 Next Steps After Database is Running

1. ✅ Database is running
2. Run migrations: `npm run prisma:migrate`
3. (Optional) Seed data: `npm run prisma:seed`
4. Start app: `npm run dev`
5. Test API: `curl http://localhost:4000/api/v1/health/live`

---

## 💡 Recommended: Use Docker

Docker is recommended because:
- ✅ Consistent environment
- ✅ No conflicts with system packages
- ✅ Includes pgvector extension
- ✅ Easy to reset and start fresh
- ✅ Matches production setup

---

*Need help? Check the logs with `docker compose logs postgres`*
