# JestBest API Testing Guide

## ✅ Server Status: RUNNING
- **Port:** 4000
- **Base URL:** `http://localhost:4000`
- **API Prefix:** `/api/v1`

---

## 🏥 Health Check Endpoints

### Live Check (Always responds if server is running)
```bash
curl http://localhost:4000/api/v1/health/live
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "status": "up",
    "timestamp": "2026-09-23T17:40:54.660Z"
  }
}
```

### Ready Check (Checks database & dependencies)
```bash
curl http://localhost:4000/api/v1/health/ready
```

---

## 🔐 Authentication Endpoints

### Register a New User
```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "name": "Test User"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "clx...",
      "email": "test@example.com",
      "name": "Test User"
    }
  }
}
```

### Login
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'
```

### Get Current User (Protected Route)
```bash
# Replace YOUR_TOKEN with the token from login/register
curl http://localhost:4000/api/v1/users/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 👥 Organization Endpoints

### Create Organization
```bash
curl -X POST http://localhost:4000/api/v1/organizations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Test Organization",
    "slug": "my-test-org"
  }'
```

### List Organizations
```bash
curl http://localhost:4000/api/v1/organizations \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📁 Project Endpoints

### Create Project
```bash
curl -X POST http://localhost:4000/api/v1/projects \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Test Project",
    "description": "Testing JestBest API",
    "organizationId": "YOUR_ORG_ID"
  }'
```

### List Projects
```bash
curl http://localhost:4000/api/v1/projects \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Project by ID
```bash
curl http://localhost:4000/api/v1/projects/PROJECT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🌐 Application Endpoints

### Create Application
```bash
curl -X POST http://localhost:4000/api/v1/applications \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "PROJECT_ID",
    "name": "My Web App",
    "baseUrl": "https://example.com",
    "description": "Main production app"
  }'
```

### Scan Application (Trigger Discovery)
```bash
curl -X POST http://localhost:4000/api/v1/applications/APP_ID/scan \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🧪 Test Management

### Create Test Case
```bash
curl -X POST http://localhost:4000/api/v1/test-cases \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "PROJECT_ID",
    "title": "Login Test",
    "description": "Test user login functionality",
    "type": "FUNCTIONAL",
    "priority": "high",
    "steps": [
      {
        "action": "goto",
        "value": "https://example.com/login"
      },
      {
        "action": "fill",
        "selector": "input[name=email]",
        "value": "test@example.com"
      },
      {
        "action": "fill",
        "selector": "input[name=password]",
        "value": "password123"
      },
      {
        "action": "click",
        "selector": "button[type=submit]"
      }
    ]
  }'
```

### Run Tests
```bash
curl -X POST http://localhost:4000/api/v1/test-runs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "PROJECT_ID",
    "testSuiteId": "TEST_SUITE_ID"
  }'
```

### Get Test Run Results
```bash
curl http://localhost:4000/api/v1/test-runs/TEST_RUN_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🐛 Bug Management

### List Bugs
```bash
curl http://localhost:4000/api/v1/bugs?projectId=PROJECT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create Bug
```bash
curl -X POST http://localhost:4000/api/v1/bugs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "PROJECT_ID",
    "title": "Login button not working",
    "description": "The login button does not respond to clicks",
    "severity": "HIGH",
    "priority": "P1",
    "reproductionSteps": [
      "Navigate to login page",
      "Enter credentials",
      "Click login button",
      "Nothing happens"
    ]
  }'
```

---

## 🤖 AI Agent Endpoints

### Trigger AI Agent
```bash
curl -X POST http://localhost:4000/api/v1/agents/trigger \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agentType": "EXPLORER",
    "projectId": "PROJECT_ID",
    "applicationId": "APP_ID"
  }'
```

### List Agent Runs
```bash
curl http://localhost:4000/api/v1/agents/runs?projectId=PROJECT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 Analytics Endpoints

### Get Dashboard Analytics
```bash
curl http://localhost:4000/api/v1/analytics/dashboard?projectId=PROJECT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Test Metrics
```bash
curl http://localhost:4000/api/v1/analytics/test-metrics?projectId=PROJECT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Flaky Tests
```bash
curl http://localhost:4000/api/v1/analytics/flaky-tests?projectId=PROJECT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔌 Integration Endpoints

### List Integrations
```bash
curl http://localhost:4000/api/v1/integrations?organizationId=ORG_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create GitHub Integration
```bash
curl -X POST http://localhost:4000/api/v1/integrations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "ORG_ID",
    "type": "GITHUB",
    "config": {
      "token": "ghp_your_github_token",
      "repository": "owner/repo"
    }
  }'
```

---

## 🔑 API Keys

### Create API Key
```bash
curl -X POST http://localhost:4000/api/v1/api-keys \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My API Key"
  }'
```

### List API Keys
```bash
curl http://localhost:4000/api/v1/api-keys \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📝 Complete Example Workflow

### 1. Register & Login
```bash
# Register
TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@jestbest.ai","password":"Demo123!@#","name":"Demo User"}' \
  | jq -r '.data.token')

echo "Token: $TOKEN"
```

### 2. Create Organization
```bash
ORG_ID=$(curl -s -X POST http://localhost:4000/api/v1/organizations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo Org","slug":"demo-org"}' \
  | jq -r '.data.id')

echo "Organization ID: $ORG_ID"
```

### 3. Create Project
```bash
PROJECT_ID=$(curl -s -X POST http://localhost:4000/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Demo Project\",\"organizationId\":\"$ORG_ID\"}" \
  | jq -r '.data.id')

echo "Project ID: $PROJECT_ID"
```

### 4. Create Application
```bash
APP_ID=$(curl -s -X POST http://localhost:4000/api/v1/applications \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"name\":\"Demo App\",\"baseUrl\":\"https://example.com\"}" \
  | jq -r '.data.id')

echo "Application ID: $APP_ID"
```

### 5. Trigger App Scan
```bash
curl -X POST http://localhost:4000/api/v1/applications/$APP_ID/scan \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🛠️ Development Tools

### Using Postman
1. Import the collection (if we create one)
2. Set environment variable `baseUrl` = `http://localhost:4000`
3. Set environment variable `token` = (your JWT token)

### Using VS Code REST Client
Create a `.http` file:

```http
### Variables
@baseUrl = http://localhost:4000/api/v1
@token = YOUR_TOKEN_HERE

### Health Check
GET {{baseUrl}}/health/live

### Register
POST {{baseUrl}}/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Test123!@#",
  "name": "Test User"
}

### Login
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Test123!@#"
}

### Get User
GET {{baseUrl}}/users/me
Authorization: Bearer {{token}}
```

---

## 🔍 Debugging Tips

### View Server Logs
The server is running with detailed logging. Watch the terminal for:
- Request/response logs
- Error messages
- Queue worker status

### Check Database
```bash
# Connect to database
docker compose exec postgres psql -U jestbest -d jestbest

# Inside psql:
\dt                     # List tables
SELECT * FROM "User";  # Query users
\q                      # Exit
```

### Check Redis
```bash
# Connect to Redis
docker compose exec redis redis-cli

# Inside redis-cli:
KEYS *                 # List all keys
GET jestbest:user:123   # Get specific key
QUIT                   # Exit
```

---

## 📚 API Documentation

For detailed API documentation, check:
- OpenAPI/Swagger: `http://localhost:4000/api/docs` (if configured)
- Source code: `/src/routes/api/v1/*.routes.ts`
- Controllers: `/src/controllers/`

---

## 🎯 Next Steps

1. ✅ Server is running
2. ✅ Database is connected
3. Test the authentication flow
4. Create an organization and project
5. Start building the frontend!

---

## 🐛 Common Issues

### 401 Unauthorized
- Check if you're including the `Authorization: Bearer TOKEN` header
- Verify token hasn't expired (15 minutes default)
- Re-login to get a fresh token

### 404 Not Found
- Verify you're using `/api/v1` prefix
- Check the endpoint URL is correct
- Look at `src/routes/api/v1/index.ts` for available routes

### 500 Internal Server Error
- Check server logs in terminal
- Verify database is running: `docker compose ps`
- Check for validation errors in request body

---

*Happy testing! 🚀*
