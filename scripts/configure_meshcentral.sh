#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

load_env_value() {
  local name="$1"
  local value

  value="$(grep -E "^${name}=" .env 2>/dev/null | tail -n 1 | cut -d= -f2- || true)"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "$value"
}

MESH_HOSTNAME="${MESH_HOSTNAME:-$(load_env_value MESH_HOSTNAME)}"
MESH_ALLOW_NEW_ACCOUNTS="${MESH_ALLOW_NEW_ACCOUNTS:-$(load_env_value MESH_ALLOW_NEW_ACCOUNTS)}"
MESH_WEBRTC="${MESH_WEBRTC:-$(load_env_value MESH_WEBRTC)}"
MESH_LOGIN_KEY="${MESH_LOGIN_KEY:-$(load_env_value MESH_LOGIN_KEY)}"
MESH_LOGIN_USER="${MESH_LOGIN_USER:-$(load_env_value MESH_LOGIN_USER)}"
MESH_TITLE="${MESH_TITLE:-$(load_env_value MESH_TITLE)}"
MESH_TITLE2="${MESH_TITLE2:-$(load_env_value MESH_TITLE2)}"

MESH_HOSTNAME="${MESH_HOSTNAME:-3.227.213.30}"
MESH_LOGIN_USER="${MESH_LOGIN_USER:-admin}"
MESH_TITLE="${MESH_TITLE:-Geimser ITSM}"
MESH_TITLE2="${MESH_TITLE2:-Centro remoto}"
export MESH_HOSTNAME MESH_ALLOW_NEW_ACCOUNTS MESH_WEBRTC MESH_LOGIN_KEY MESH_LOGIN_USER MESH_TITLE MESH_TITLE2

if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  COMPOSE=(docker compose)
fi

if ! "${COMPOSE[@]}" ps >/dev/null 2>&1; then
  COMPOSE=(sudo -E "${COMPOSE[@]}")
fi

"${COMPOSE[@]}" run --rm --entrypoint sh meshcentral -lc "
node <<'NODE'
const fs = require('fs');
const configPath = '/opt/meshcentral/meshcentral-data/config.json';
const host = process.env.MESH_HOSTNAME || '${MESH_HOSTNAME}';
const loginKey = (process.env.MESH_LOGIN_KEY || '').trim();
const title = (process.env.MESH_TITLE || '').trim();
const title2 = (process.env.MESH_TITLE2 || '').trim();

const config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
  : {};

config.settings = config.settings || {};
config.domains = config.domains || {};
config.domains[''] = config.domains[''] || {};

config.settings.cert = host;
config.settings.port = 443;
config.settings.aliasPort = 443;
config.settings.allowFraming = true;
config.settings.allowLoginToken = true;
if (/^[0-9a-f]{160}$/i.test(loginKey)) {
  config.settings.logincookieencryptionkey = loginKey;
} else {
  delete config.settings.logincookieencryptionkey;
}
config.settings.webRTC = process.env.MESH_WEBRTC === 'true';
config.settings.browserPing = 60;
config.settings.browserPong = 60;
config.domains[''].allowedOrigin = true;
config.domains[''].allowFraming = true;
delete config.settings.loginCookieEncryptionKey;
delete config.domains[''].loginKey;
config.domains[''].newAccounts = process.env.MESH_ALLOW_NEW_ACCOUNTS === 'true';
config.domains[''].title = title;
config.domains[''].title2 = title2;
config.domains[''].certUrl = 'https://' + host;
if (config.domains[''].customFiles && config.domains[''].customFiles.geimser) {
  delete config.domains[''].customFiles.geimser;
  if (Object.keys(config.domains[''].customFiles).length === 0) {
    delete config.domains[''].customFiles;
  }
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('MeshCentral configurado para ' + host);
NODE
"

mesh_users="$("${COMPOSE[@]}" exec -T meshcentral node /opt/meshcentral/meshcentral --listuserids 2>/dev/null || "${COMPOSE[@]}" run --rm --entrypoint node meshcentral /opt/meshcentral/meshcentral --listuserids 2>/dev/null || true)"
if ! printf '%s\n' "$mesh_users" | grep -Fxq "user//${MESH_LOGIN_USER}"; then
  printf 'ADVERTENCIA: MESH_LOGIN_USER=%s no existe en MeshCentral.\n' "$MESH_LOGIN_USER" >&2
  printf 'El SSO puede iniciar sesion, pero MeshCentral mostrara la vista vacia o el login si ese usuario no existe.\n' >&2
  printf 'Crea ese usuario en MeshCentral y dale permisos sobre el grupo QA, o promuevelo como administrador del sitio.\n' >&2
fi

PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$(basename "$PWD" | tr '[:upper:] ' '[:lower:]_' | sed 's/[^a-z0-9_-]/_/g')}"
MESH_WEB_VOLUME="${PROJECT_NAME}_meshcentral-web"
if command -v docker >/dev/null 2>&1; then
  docker volume create "$MESH_WEB_VOLUME" >/dev/null
  docker run --rm -i \
    -v "${MESH_WEB_VOLUME}:/meshcentral-web" \
    busybox sh -c 'mkdir -p /meshcentral-web/public/scripts && cat > /meshcentral-web/public/scripts/custom.js' \
    < branding/meshcentral/custom.js
else
  printf 'ERROR: Docker no esta disponible para instalar custom.js de MeshCentral.\n' >&2
  exit 1
fi
