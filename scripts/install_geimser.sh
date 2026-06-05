#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

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
  if [ "$name" = "GEIMSER_ADMIN_PASSWORD" ]; then
    GENERATED_ADMIN_PASSWORD="$value"
  fi
  printf 'Se genero %s para esta instalacion.\n' "$name"
}

GENERATED_ADMIN_PASSWORD=""
touch .env
ensure_env_secret GEIMSER_CMDB_TOKEN
ensure_env_secret GEIMSER_ADMIN_PASSWORD
ensure_env_secret MESH_LOGIN_KEY 80

if ! docker info >/dev/null 2>&1; then
  if command -v colima >/dev/null 2>&1; then
    colima start --cpu 4 --memory 6 --disk 40
  else
    echo "Docker no esta activo. Inicia Docker/Colima y vuelve a ejecutar este script." >&2
    exit 1
  fi
fi

docker-compose pull zammad-elasticsearch zammad-memcached zammad-postgresql zammad-redis meshcentral
docker-compose build zammad-backup zammad-init zammad-nginx zammad-railsserver zammad-scheduler zammad-websocket
docker-compose up -d
./scripts/configure_meshcentral.sh
docker-compose up -d --force-recreate meshcentral

echo "Esperando a que Geimser ITSM quede saludable..."
for _ in {1..90}; do
  railsserver_id="$(docker-compose ps -q zammad-railsserver 2>/dev/null || true)"
  status="$(docker inspect -f '{{.State.Health.Status}}' "$railsserver_id" 2>/dev/null || true)"
  if [ "$status" = "healthy" ]; then
    break
  fi
  sleep 10
done

docker-compose run --rm zammad-railsserver bundle exec rails r /opt/zammad/contrib/geimser/configure_geimser.rb

echo "Aplicando estilos personalizados Geimser..."
docker-compose restart zammad-nginx zammad-railsserver zammad-websocket zammad-scheduler

echo "Geimser ITSM disponible en http://localhost:8080"
echo "MeshCentral disponible en https://localhost:${MESH_EXPOSE_PORT:-443}"
if [ -n "$GENERATED_ADMIN_PASSWORD" ]; then
  echo "Usuario inicial: admin@geimser.local"
  echo "Clave inicial: ${GENERATED_ADMIN_PASSWORD}"
fi
