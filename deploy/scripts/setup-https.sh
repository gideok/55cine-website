#!/usr/bin/env bash
# 서버에서 실행: Let's Encrypt HTTPS 적용 (55cine.com)
set -euo pipefail

 Domains=(-d 55cine.com -d www.55cine.com)
EMAIL="${CERTBOT_EMAIL:-admin@55cine.com}"
APP_ROOT="${APP_ROOT:-/var/www/55cine}"

echo "[https] install certbot"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y certbot python3-certbot-nginx

# 발급 전: HTTP만 열린 상태로 server_name 맞추기 (리다이렉트 없는 임시 설정)
echo "[https] prepare HTTP vhost for ACME"
cat > /etc/nginx/sites-available/55cine.conf <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name 55cine.com www.55cine.com _;

    root /var/www/55cine;
    index index.html;
    client_max_body_size 25m;

    location /.well-known/acme-challenge/ {
        root /var/www/55cine;
        allow all;
    }

    location / {
        try_files $uri $uri/ $uri.html =404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location /images/ {
        try_files $uri =404;
        expires 7d;
        add_header Cache-Control "public";
    }
}
NGINX

ln -sf /etc/nginx/sites-available/55cine.conf /etc/nginx/sites-enabled/55cine.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "[https] issue certificate"
certbot --nginx \
  -d 55cine.com \
  -d www.55cine.com \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  --redirect \
  --keep-until-expiring

# 최종 HTTPS 설정(저장소와 동기화) — 인증서가 있을 때만
if [[ -f /etc/letsencrypt/live/55cine.com/fullchain.pem ]]; then
  if [[ -f "$APP_ROOT/deploy/nginx/55cine.conf" ]]; then
    echo "[https] install project nginx HTTPS config"
    cp "$APP_ROOT/deploy/nginx/55cine.conf" /etc/nginx/sites-available/55cine.conf
    nginx -t && systemctl reload nginx
  fi
fi

# 관리자 쿠키 Secure
if [[ -f "$APP_ROOT/.env" ]]; then
  if grep -q '^ADMIN_SECURE_COOKIE=' "$APP_ROOT/.env"; then
    sed -i 's/^ADMIN_SECURE_COOKIE=.*/ADMIN_SECURE_COOKIE=true/' "$APP_ROOT/.env"
  else
    echo 'ADMIN_SECURE_COOKIE=true' >> "$APP_ROOT/.env"
  fi
  systemctl restart 55cine-api || true
fi

# 자동 갱신 타이머
systemctl enable --now certbot.timer 2>/dev/null || true
systemctl list-timers 'certbot*' --no-pager || true

echo "[https] verify"
curl -sI --max-time 10 https://55cine.com/ | head -8 || true
echo "[https] done"
