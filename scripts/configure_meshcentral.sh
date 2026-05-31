#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

MESH_HOSTNAME="${MESH_HOSTNAME:-3.227.213.30}"

docker-compose run --rm --entrypoint sh meshcentral -lc "
node <<'NODE'
const fs = require('fs');
const path = '/opt/meshcentral/meshcentral-data/config.json';
const host = process.env.MESH_HOSTNAME || '${MESH_HOSTNAME}';
const loginKey = (process.env.MESH_LOGIN_KEY || '').trim();

const config = fs.existsSync(path)
  ? JSON.parse(fs.readFileSync(path, 'utf8'))
  : {};

config.settings = config.settings || {};
config.domains = config.domains || {};
config.domains[''] = config.domains[''] || {};

config.settings.cert = host;
config.settings.port = 443;
config.settings.aliasPort = 443;
config.settings.allowFraming = true;
config.settings.webRTC = process.env.MESH_WEBRTC === 'true';
config.settings.browserPing = 60;
config.settings.browserPong = 60;
config.domains[''].allowedOrigin = true;
config.domains[''].allowFraming = true;
if (/^[0-9a-f]{160}$/i.test(loginKey)) {
  config.domains[''].loginKey = [loginKey];
}
config.domains[''].newAccounts = process.env.MESH_ALLOW_NEW_ACCOUNTS === 'true';
config.domains[''].title = 'ITSM Geimser Remote';
config.domains[''].certUrl = 'https://' + host;

fs.writeFileSync(path, JSON.stringify(config, null, 2));
console.log('MeshCentral configurado para ' + host);
NODE
"
