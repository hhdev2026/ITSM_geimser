#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

ITSM_HOST="${ITSM_HOST:-itsm.geimser.cl}"
MESH_HOST="${MESH_HOST:-remoto.geimser.cl}"

case "$(uname -m)" in
  x86_64) DOCKER_PLATFORM="linux/amd64" ;;
  aarch64|arm64) DOCKER_PLATFORM="linux/arm64" ;;
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

set_env NGINX_EXPOSE_PORT 127.0.0.1:8080
set_env NGINX_PORT 8080
set_env NGINX_SERVER_NAME _
set_env DOCKER_PLATFORM "$DOCKER_PLATFORM"
set_env ZAMMAD_FQDN "$ITSM_HOST"
set_env ZAMMAD_HTTP_TYPE https
set_env MESH_HOSTNAME "$MESH_HOST"
set_env MESH_EXPOSE_PORT 127.0.0.1:8443

docker-compose up -d --force-recreate \
  zammad-railsserver \
  zammad-websocket \
  zammad-scheduler \
  zammad-nginx

echo "Esperando a que Geimser ITSM quede saludable..."
for _ in {1..90}; do
  railsserver_id="$(docker-compose ps -q zammad-railsserver 2>/dev/null || true)"
  status="$(docker inspect -f '{{.State.Health.Status}}' "$railsserver_id" 2>/dev/null || true)"
  if [ "$status" = "healthy" ]; then
    break
  fi
  sleep 5
done

if [ "${status:-unknown}" != "healthy" ]; then
  echo "Geimser ITSM no quedo saludable dentro del tiempo esperado." >&2
  exit 1
fi

docker-compose run --rm zammad-railsserver bundle exec rails r "
UserInfo.current_user_id = 1 if defined?(UserInfo)
Setting.set('http_type', 'https')
Setting.set('fqdn', '${ITSM_HOST}')
Rails.cache.clear if defined?(Rails)
"

docker-compose restart zammad-railsserver zammad-websocket zammad-scheduler zammad-nginx

echo "CSRF/HTTPS corregido para https://${ITSM_HOST}"
