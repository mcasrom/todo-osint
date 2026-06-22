#!/bin/bash
set -e

echo "=== [TODO-OSINT DEPLOY] ==="

apt update && apt upgrade -y
apt install -y curl git nginx certbot python3-certbot-nginx

curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

DOMAIN="${1:-todo-osint.tudominio.com}"
EMAIL="${2:-threatradar-osint@viajeinteligencia.com}"

APP_DIR="/opt/todo-osint"
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR" && git pull
else
  git clone https://github.com/mcasrom/todo-osint.git "$APP_DIR"
  cd "$APP_DIR"
fi

npm ci --only=production

if [ ! -f .env ]; then
  cp .env.example .env
  echo "[!] Edit .env with your GEMINI_API_KEY"
fi

npm run build
npm install -g pm2

pm2 delete todo-osint 2>/dev/null || true
pm2 start dist/server.cjs --name todo-osint
pm2 save
pm2 startup systemd -u root --hp /root

sed "s/todo-osint.tudominio.com/${DOMAIN}/g" deploy/nginx.conf > /etc/nginx/sites-available/todo-osint
ln -sf /etc/nginx/sites-available/todo-osint /etc/nginx/sites-enabled/todo-osint
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --email "${EMAIL}"

ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable

echo "=== [DONE] ==="
echo "App: https://${DOMAIN}"
echo "Edit .env for GEMINI_API_KEY, then: pm2 restart todo-osint"
