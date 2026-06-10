#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

failures=0

reject() {
  local pattern="$1"
  local file="$2"
  local reason="$3"

  if rg -n "$pattern" "$file"; then
    printf 'ERROR: %s\n' "$reason" >&2
    failures=$((failures + 1))
  fi
}

reject_any() {
  local pattern="$1"
  local reason="$2"
  shift 2

  if rg -n "$pattern" "$@"; then
    printf 'ERROR: %s\n' "$reason" >&2
    failures=$((failures + 1))
  fi
}

reject '#app[[:space:]]+\.content:has\(h1\)' branding/geimser.css \
  'No se debe cambiar el layout de todas las vistas que contienen un titulo.'
reject '^[[:space:]]*\.sidebar,[[:space:]]*$' branding/geimser.css \
  'La clase .sidebar es compartida por Zammad; solo se deben estilizar sidebars con contexto de ruta o .geimser-nav-surface.'
reject '#app\.geimser-route-ticket[[:space:]]+\.ticketZoom[[:space:]]+\[contenteditable="true"\][[:space:]]*,' branding/geimser.css \
  'El estilo del editor debe quedar dentro de .js-writeArea para no deformar el titulo editable del ticket.'
reject '^[[:space:]]*normalizeSidebarFooter\(\);' branding/geimser.js \
  'No se deben clasificar footers por coordenadas.'
reject '^[[:space:]]*styleSidebarDockControls\(\);' branding/geimser.js \
  'No se deben aplicar estilos inline a controles detectados por coordenadas.'
reject '^[[:space:]]*normalizeNavigationContrast\(\);' branding/geimser.js \
  'No se debe recolorear todo el sidebar en cada mutacion del DOM.'
reject '^[[:space:]]*fixSidebarSearchDropdowns\(\);' branding/geimser.js \
  'No se deben reposicionar resultados de busqueda mediante estilos inline.'
reject 'skip_before_action[[:space:]]+:authentication_check' branding/controllers/geimser_mesh_login_controller.rb \
  'Ninguna ruta CMDB personalizada debe omitir autenticacion.'
reject "ENV\\.fetch\\('GEIMSER_CMDB_TOKEN',[[:space:]]*'geimser-cmdb-local'\\)" branding/controllers/geimser_mesh_login_controller.rb \
  'El token CMDB no puede tener un valor predeterminado conocido.'
reject "ENV\\.fetch\\('GEIMSER_ADMIN_PASSWORD',[[:space:]]*'[^']+'\\)" scripts/configure_geimser.rb \
  'La clave administrativa no puede tener un valor predeterminado.'
reject_any '(^|[;{])[[:space:]]*(color|-webkit-text-fill-color)[[:space:]]*:[[:space:]]*(var\(--geimser-orange|#f28c18|#f5a623|#f59e0b|orange)\b' \
  'El naranja Geimser no debe usarse como color de texto; reservarlo para acentos, bordes o fondos con texto contrastado.' \
  branding/geimser.css
reject_any "(style\\.(color|webkitTextFillColor)[[:space:]]*=|setProperty\\(['\\\"](color|-webkit-text-fill-color)['\\\"],[[:space:]]*)['\\\"](#f28c18|#f5a623|#f59e0b|orange)" \
  'El naranja Geimser no debe aplicarse por JavaScript como color de texto.' \
  branding/geimser.js
reject_any '#geimser/cmdb' \
  'No debe existir la ruta legacy #geimser/cmdb; CMDB debe entrar por la vista nativa #system/integration/idoit.' \
  branding/geimser.js branding/routes/geimser_mesh_login.rb
reject_any '#geimser/users-cmdb|/geimser/cmdb/users' \
  'No debe existir la ruta legacy de usuarios CMDB; el inventario debe entrar por la vista nativa #system/integration/idoit.' \
  branding/geimser.js branding/routes/geimser_mesh_login.rb
reject_any '\.geimser-cmdb-view' \
  'No se debe renderizar ni estilizar una segunda CMDB visual; mantener una sola CMDB visible.' \
  branding/geimser.js branding/geimser.css
reject_any '\.geimser-user-cmdb-view|geimser-user-cmdb' \
  'No se debe renderizar ni estilizar una vista paralela de usuarios CMDB.' \
  branding/geimser.js branding/geimser.css
reject_any '\.geimser-remote-button|geimser-remote-button' \
  'La toma remota no debe depender de un boton flotante global; debe ser contextual al ticket o activo CMDB.' \
  branding/geimser.js branding/geimser.css
reject_any '\.geimser-context-remote-button|geimser-context-remote-button' \
  'La toma remota no debe depender de un boton fijo en body; debe vivir dentro del ticket o del activo CMDB.' \
  branding/geimser.js branding/geimser.css
if perl -0777 -ne 'exit(/#app \.geimser-profile-popup\s*\{[^}]*position:\s*relative/s ? 0 : 1)' branding/geimser.css; then
  printf 'ERROR: El popup de perfil no debe perder el posicionamiento flotante nativo.\n' >&2
  failures=$((failures + 1))
fi

if perl -0777 -ne 'exit(/remote_attributes = \[.*?remote_attributes\.each.*?\x27ticket\.customer\x27\s*=>/s ? 0 : 1)' scripts/configure_geimser.rb; then
  printf 'ERROR: Los clientes no deben ver ni editar campos de soporte remoto.\n' >&2
  failures=$((failures + 1))
fi

if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  printf 'ERROR: .env contiene secretos y no debe estar versionado.\n' >&2
  failures=$((failures + 1))
fi

if ! rg -q 'ensure_env_secret MESH_LOGIN_KEY 80' scripts/install_geimser.sh; then
  printf 'ERROR: Las instalaciones nuevas deben generar una clave Mesh unica.\n' >&2
  failures=$((failures + 1))
fi

if ! rg -q "node_id\\.to_s\\.split\\('/', 3\\)\\.last" branding/initializers/geimser_mesh_cmdb.rb; then
  printf 'ERROR: El enlace Mesh debe usar solo el token final del NodeID en gotonode.\n' >&2
  failures=$((failures + 1))
fi
if ! rg -q "'gotonode' => node_token" branding/initializers/geimser_mesh_cmdb.rb branding/controllers/geimser_mesh_login_controller.rb; then
  printf 'ERROR: El embed de escritorio Mesh debe usar gotonode con viewmode=11.\n' >&2
  failures=$((failures + 1))
fi
if ! rg -q 'connectDesktop\(null, 3\)' branding/meshcentral/custom.js; then
  printf 'ERROR: El autoconnect Mesh debe usar el tipo de conexion normal del boton Desktop.\n' >&2
  failures=$((failures + 1))
fi

node --check branding/geimser.js
ruby -c scripts/configure_geimser.rb >/dev/null
ruby -c branding/initializers/geimser_mesh_cmdb.rb >/dev/null

if (( failures > 0 )); then
  exit 1
fi

printf 'Frontend safety checks: OK\n'
