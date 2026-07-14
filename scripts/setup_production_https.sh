#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

ITSM_HOST="${ITSM_HOST:-itsm.geimser.cl}"
MESH_HOST="${MESH_HOST:-remoto.geimser.cl}"

case "$(uname -m)" in
  x86_64)
    DOCKER_PLATFORM="linux/amd64"
    ;;
  aarch64|arm64)
    DOCKER_PLATFORM="linux/arm64"
    ;;
  *)
    echo "Arquitectura no soportada: $(uname -m)" >&2
    exit 1
    ;;
esac

set_env() {
  local key="$1"
  local value="$2"

  if grep -q "^${key}=" .env; then
    sed -i "s#^${key}=.*#${key}=${value}#" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

ensure_env_secret() {
  local name="$1"
  local bytes="${2:-32}"
  local value

  value="${!name:-}"
  if [ -n "$value" ]; then
    if ! awk -F= -v key="$name" '$1 == key {found=1} END {exit !found}' .env 2>/dev/null; then
      printf '\n%s=%s\n' "$name" "$value" >> .env
    fi
    export "${name}=${value}"
    return
  fi

  value="$(awk -F= -v key="$name" '$1 == key {sub(/^[^=]*=/, ""); print; exit}' .env 2>/dev/null || true)"
  if [ -n "$value" ]; then
    export "${name}=${value}"
    return
  fi

  value="$(openssl rand -hex "$bytes")"
  printf '\n%s=%s\n' "$name" "$value" >> .env
  export "${name}=${value}"
  printf 'Se genero %s para esta instalacion.\n' "$name"
}

touch .env
set_env NGINX_EXPOSE_PORT 127.0.0.1:8080
set_env NGINX_PORT 8080
set_env NGINX_SERVER_NAME _
set_env DOCKER_PLATFORM "$DOCKER_PLATFORM"
set_env ZAMMAD_FQDN "$ITSM_HOST"
set_env ZAMMAD_HTTP_TYPE https
set_env MESH_HOSTNAME "$MESH_HOST"
set_env MESH_PUBLIC_URL "https://${MESH_HOST}"
set_env MESH_LOGIN_USER "${MESH_LOGIN_USER:-admin}"
set_env GEIMSER_DEMO_USER "${GEIMSER_DEMO_USER:-demo@geimser.local}"
set_env GEIMSER_DEMO_VERIFY_URL "${GEIMSER_DEMO_VERIFY_URL:-https://www.geimser.cl/api/experience/demo-ticket}"
ensure_env_secret MESH_LOGIN_KEY 80
ensure_env_secret GEIMSER_CMDB_TOKEN
ensure_env_secret GEIMSER_ADMIN_PASSWORD
set_env MESH_EXPOSE_PORT 127.0.0.1:8443

docker-compose up -d --force-recreate \
  zammad-railsserver \
  zammad-websocket \
  zammad-scheduler \
  meshcentral

echo "Esperando a que Geimser ITSM quede saludable..."
for _ in {1..90}; do
  railsserver_id="$(docker-compose ps -q zammad-railsserver 2>/dev/null || true)"
  status="$(docker inspect -f '{{.State.Health.Status}}' "$railsserver_id" 2>/dev/null || true)"
  if [ "$status" = "healthy" ]; then
    break
  fi
  sleep 10
done

if [ "${status:-unknown}" != "healthy" ]; then
  echo "Geimser ITSM no quedo saludable dentro del tiempo esperado." >&2
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
    proxy_set_header X-Forwarded-Host \$host;
    proxy_set_header X-Forwarded-Port \$server_port;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-Ssl on;
    proxy_redirect off;
    proxy_hide_header X-Frame-Options;
    add_header Content-Security-Policy "frame-ancestors 'self' https://www.geimser.cl https://geimser.cl" always;
    proxy_cookie_flags ~ secure httponly samesite=none;
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
    proxy_set_header X-Forwarded-Host \$host;
    proxy_set_header X-Forwarded-Port \$server_port;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-Ssl on;
    proxy_redirect off;
    proxy_cookie_path / "/; Secure; SameSite=Lax";
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
./scripts/verify_demo_account.sh
docker-compose restart zammad-railsserver zammad-websocket zammad-scheduler zammad-nginx

echo "Geimser ITSM disponible en https://${ITSM_HOST}"
echo "Centro remoto disponible en https://${MESH_HOST}"
