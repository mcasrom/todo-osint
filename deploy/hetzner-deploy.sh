#!/bin/bash
# Todo-OSINT deploy en Hetzner (Docker). Seguro: no borra config existente, no toca puertos ocupados.
# Uso: ./deploy/hetzner-deploy.sh <DOMAIN> <EMAIL> [APP_PORT]
#   APP_PORT: puerto host para la app (default 3000). Si 3000 está ocupado en el server, cámbialo.
set -e

DOMAIN="${1:?Uso: $0 <dominio> <email> [app_port]}"
EMAIL="${2:-threatradar-osint@viajeinteligencia.com}"
APP_PORT="${3:-3000}"

echo "=== [TODO-OSINT DEPLOY] domain=$DOMAIN port=$APP_PORT ==="

# 1. Dependencias (idempotente)
apt-get update -y
apt-get install -y -q docker.io docker-compose-plugin nginx certbot python3-certbot-nginx ufw
systemctl enable --now docker

# 2. Codigo (NO clona .env: está gitignored)
APP_DIR="/opt/todo-osint"
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git pull --ff-only
else
  git clone https://github.com/mcasrom/todo-osint.git "$APP_DIR"
  cd "$APP_DIR"
fi

# 3. .env local en el server (NUNCA viene de git). Lo creas tú manualmente.
if [ ! -f "$APP_DIR/.env" ]; then
  echo "[!] Falta $APP_DIR/.env — cópialo con tus GEMINI_API_KEY / GROQ_API_KEY y ejecuta de nuevo."
  echo "    Plantilla: $APP_DIR/.env.example"
  exit 1
fi

# 4. Build & run (puerto mapeado solo en host, sin tocar 80/443 del nginx del server)
sed -i "s/\"3000:3000\"/\"${APP_PORT}:3000\"/" docker-compose.yml
docker compose up -d --build

# 5. nginx: AÑADE un server_block nuevo, NO borra los existentes
CONF="/etc/nginx/sites-available/todo-osint"
cp "deploy/nginx.conf" "$CONF"
sed -i "s/todo-osint.tudominio.com/${DOMAIN}/g" "$CONF"
sed -i "s/127.0.0.1:3000/127.0.0.1:${APP_PORT}/g" "$CONF"
if [ ! -e "/etc/nginx/sites-enabled/todo-osint" ]; then
  ln -s "$CONF" /etc/nginx/sites-enabled/todo-osint
fi
nginx -t && systemctl reload nginx

# 6. SSL (solo para este dominio)
certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --email "${EMAIL}" || echo "[!] Certbot falló (domain apuntó?). Continúa en HTTP."

# 7. Firewall (mantiene 22/80/443)
ufw allow 22/tcp; ufw allow 80/tcp; ufw allow 443/tcp; ufw --force enable || true

echo "=== [DONE] ==="
echo "App: https://${DOMAIN}  (internamente en host :${APP_PORT})"
echo "Logs: docker compose -f $APP_DIR/docker-compose.yml logs -f"
