#!/usr/bin/env bash
# 운영 서버 최초 1회: Node.js 20 + Nginx 설치 및 기본 디렉터리 생성
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

echo "[bootstrap] apt update"
apt-get update -y

if ! command -v node >/dev/null 2>&1; then
  echo "[bootstrap] install Node.js 20"
  apt-get install -y ca-certificates curl gnupg
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "[bootstrap] install Nginx"
  apt-get install -y nginx
  systemctl enable nginx
fi

mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

echo "[bootstrap] create app directory"
mkdir -p /var/www/55cine
chown -R www-data:www-data /var/www/55cine

node -v
nginx -v
echo "[bootstrap] done"
