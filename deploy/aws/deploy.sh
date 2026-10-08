#!/bin/bash
# Pull the latest main and roll the stack. Run ON the EC2 instance:
#   bash /opt/jestbest/deploy/aws/deploy.sh
set -euo pipefail

APP_DIR=/opt/jestbest
cd "$APP_DIR"

git fetch origin main
git reset --hard origin/main

cd "$APP_DIR/deploy/aws"
# `--build` rebuilds the API image from the new source; migrations run in the
# container entrypoint before the server accepts traffic.
docker compose up -d --build
docker compose ps
