#!/bin/bash
# EC2 user-data: bootstrap a t3.micro (Amazon Linux 2023 / Ubuntu) to run the
# JestBest API + Redis + Caddy behind automatic HTTPS.
#
# Paste this whole file into "User data" when launching the instance.
# After it finishes, SSH in, edit /opt/jestbest/deploy/aws/.env, then:
#   cd /opt/jestbest/deploy/aws && docker compose up -d --build
set -euxo pipefail

REPO=https://github.com/whomimohshukla/JestBest.git
APP_DIR=/opt/jestbest

# 1. Base packages (dnf for Amazon Linux, apt for Ubuntu).
if command -v dnf >/dev/null 2>&1; then
  dnf update -y
  dnf install -y git
elif command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y git ca-certificates curl
fi

# 2. Add swap. t3.micro has 1 GB RAM and `npm ci` + `tsc` can OOM without it.
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi

# 3. Docker Engine + Compose plugin (official convenience script).
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
usermod -aG docker ec2-user 2>/dev/null || usermod -aG docker ubuntu 2>/dev/null || true

# 4. Clone the app (idempotent).
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR/deploy/aws"
[ -f .env ] || cp .env.example .env
chown -R "$(id -u ec2-user >/dev/null 2>&1 && echo ec2-user || echo ubuntu)": "$APP_DIR" 2>/dev/null || true

echo "Bootstrap done. Edit $APP_DIR/deploy/aws/.env then run:"
echo "  cd $APP_DIR/deploy/aws && sudo docker compose up -d --build"
