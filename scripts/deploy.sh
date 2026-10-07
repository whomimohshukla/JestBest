#!/usr/bin/env bash
# Roll out a new build on the host. Idempotent: safe to re-run.
#
# The only prerequisite is ~/jestbest/.env.prod on the machine (created once by
# hand — it holds the database password, JWT secrets and the encryption key, and
# is never committed anywhere).
#
#   ECR_REGISTRY=123456.dkr.ecr.us-east-1.amazonaws.com \
#   API_IMAGE=...:sha WEB_IMAGE=...:sha ./deploy.sh
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Create it first (see the Deployment section of README.md)." >&2
  exit 1
fi

if [[ -n "${ECR_REGISTRY:-}" ]]; then
  aws ecr get-login-password --region "${AWS_REGION:-us-east-1}" |
    docker login --username AWS --password-stdin "$ECR_REGISTRY"
fi

echo "==> Pulling images"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull api web

echo "==> Applying migrations and starting"
# Recreates only containers whose image changed, and starts postgres/redis the
# first time this is ever run. The api container runs `prisma migrate deploy`
# before the server, so schema and code move together.
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans api web

echo "==> Waiting for readiness"
for i in $(seq 1 30); do
  if docker inspect --format='{{.State.Health.Status}}' jestbest-api 2>/dev/null |
    grep -q healthy; then
    echo "api healthy"
    break
  fi
  sleep 5
  if [[ "$i" == "30" ]]; then
    echo "ERROR: api never became healthy" >&2
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --tail 50 api
    exit 1
  fi
done

echo "==> Pruning old images"
docker image prune -f >/dev/null

echo "==> Done"
