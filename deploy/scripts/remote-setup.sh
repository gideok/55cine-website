#!/usr/bin/env bash
# 서버에서 앱 배포 후 실행: Nginx·systemd 등록 및 API 기동
set -euo pipefail

APP_ROOT="/var/www/55cine"
REPO_DEPLOY_DIR="${1:-}"

if [[ -n "$REPO_DEPLOY_DIR" && -d "$REPO_DEPLOY_DIR/deploy" ]]; then
  cp "$REPO_DEPLOY_DIR/deploy/nginx/55cine.conf" /etc/nginx/sites-available/55cine.conf
  cp "$REPO_DEPLOY_DIR/deploy/systemd/55cine-api.service" /etc/systemd/system/55cine-api.service
fi

ln -sf /etc/nginx/sites-available/55cine.conf /etc/nginx/sites-enabled/55cine.conf
rm -f /etc/nginx/sites-enabled/default

chown -R www-data:www-data "$APP_ROOT"
chmod 640 "$APP_ROOT/.env" || true

cd "$APP_ROOT/api"
npm ci --omit=dev

systemctl daemon-reload
systemctl enable 55cine-api
systemctl restart 55cine-api

nginx -t
systemctl reload nginx

echo "[remote-setup] API status:"
systemctl --no-pager status 55cine-api | head -15
