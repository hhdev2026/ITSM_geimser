#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

ITSM_HOST="${ITSM_HOST:-itsm.geimser.cl}"
MESH_HOST="${MESH_HOST:-remoto.geimser.cl}"

set_env() {
  local key="$1"
  local value="$2"

  if grep -q "^${key}=" .env; then
    sed -i "s#^${key}=.*#${key}=${value}#" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

set_env NGINX_EXPOSE_PORT 127.0.0.1:8080
set_env NGINX_PORT 8080
set_env NGINX_SERVER_NAME _
set_env ZAMMAD_FQDN "$ITSM_HOST"
set_env ZAMMAD_HTTP_TYPE https
set_env MESH_HOSTNAME "$MESH_HOST"
set_env MESH_EXPOSE_PORT 127.0.0.1:8443

docker-compose up -d --force-recreate \
  zammad-railsserver \
  zammad-websocket \
  zammad-scheduler \
  meshcentral

echo "Esperando a que Zammad quede saludable..."
for _ in {1..90}; do
  railsserver_id="$(docker-compose ps -q zammad-railsserver 2>/dev/null || true)"
  status="$(docker inspect -f '{{.State.Health.Status}}' "$railsserver_id" 2>/dev/null || true)"
  if [ "$status" = "healthy" ]; then
    break
  fi
  sleep 10
done

if [ "${status:-unknown}" != "healthy" ]; then
  echo "Zammad no quedo saludable dentro del tiempo esperado." >&2
  exit 1
fi

docker-compose up -d --force-recreate zammad-nginx

./scripts/configure_meshcentral.sh
docker-compose up -d --force-recreate meshcentral

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx

cat >/etc/nginx/sites-available/itsm-geimser <<NGINX
map \$http_upgrade \$connection_upgrade {
  default upgrade;
  '' close;
}

server {
  listen 80;
  listen [::]:80;
  server_name ${ITSM_HOST};

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}

server {
  listen 80;
  listen [::]:80;
  server_name ${MESH_HOST};

  location / {
    proxy_pass https://127.0.0.1:8443;
    proxy_http_version 1.1;
    proxy_ssl_verify off;
    proxy_set_header Host \$host;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }
}
NGINX

rm -f /etc/nginx/sites-enabled/default
ln -sfn /etc/nginx/sites-available/itsm-geimser /etc/nginx/sites-enabled/itsm-geimser
nginx -t
systemctl enable --now nginx
systemctl reload nginx

certbot --nginx \
  --non-interactive \
  --agree-tos \
  --register-unsafely-without-email \
  --redirect \
  -d "$ITSM_HOST" \
  -d "$MESH_HOST"

docker-compose restart meshcentral
docker-compose run --rm zammad-railsserver \
  bundle exec rails r /opt/zammad/contrib/geimser/configure_geimser.rb
docker-compose restart zammad-railsserver zammad-websocket zammad-scheduler zammad-nginx

echo "ITSM Geimser disponible en https://${ITSM_HOST}"
echo "Centro remoto disponible en https://${MESH_HOST}"
