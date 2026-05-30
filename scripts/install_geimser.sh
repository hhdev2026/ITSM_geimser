#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! docker info >/dev/null 2>&1; then
  if command -v colima >/dev/null 2>&1; then
    colima start --cpu 4 --memory 6 --disk 40
  else
    echo "Docker no esta activo. Inicia Docker/Colima y vuelve a ejecutar este script." >&2
    exit 1
  fi
fi

docker-compose pull
docker-compose up -d

echo "Esperando a que Zammad quede saludable..."
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

echo "ITSM Geimser disponible en http://localhost:8080"
