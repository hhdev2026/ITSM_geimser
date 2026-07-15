# ITSM Geimser sobre Zammad

Esta carpeta contiene una instalacion Docker Compose de Zammad preparada para Apple Silicon/M1 y personalizada como **ITSM Geimser**.

## Origen y version

- Compose oficial: `https://github.com/zammad/zammad-docker-compose`
- Version fijada: `7.0.1-0048`
- Arquitectura: `linux/arm64`
- URL local: `http://localhost:8080`

## Marca aplicada (arquitectura v4, "GEIMSER DESIGN SYSTEM v4")

- Nombre de plataforma: `ITSM Geimser`
- Empresa: `Geimser`
- Logo: `branding/geimser-logo.png` / `branding/geimser-logo-mark.png`
- Sistema de diseño: tokens semanticos `--gx-*` con dual theme real (`html[data-theme="light"]` / `html[data-theme="dark"]`); las vars core de Zammad (`--background-*`, `--text-*`) se mapean a esos tokens. Ningun hex fuera de las definiciones de tokens.
- Tipografia unica: Inter variable, self-hosted desde `branding/fonts/` (no se usa Roboto/Open Sans/Lato).
- Idioma: espanol Chile (`es-cl`)
- Zona horaria: `America/Santiago`

El overlay **no** se sirve como CSS externo desde Nginx: se hornea directamente en la imagen Docker mediante `docker/geimser-zammad/Dockerfile`, que copia `branding/geimser.css`, `branding/geimser.js`, fuentes, logos, el layout `application.html.erb` y los controllers/initializers/routes Ruby personalizados (login MeshCentral, CSP, sesiones) hacia las rutas correspondientes de `/opt/zammad`. `branding/nginx-geimser.conf` queda como referencia historica y no esta referenciado por el build actual.

Cache-bust: `application.html.erb` carga `geimser.css?v=N` y `geimser.js?v=N` — incrementar `N` en cada cambio de esos archivos (estado a 2026-06-17: css v=102, js v=91).

## Archivos agregados

- `.env`: variables locales de Zammad (incluye `GEIMSER_ADMIN_PASSWORD`, `GEIMSER_CMDB_TOKEN`, `MESH_*`, autogeneradas por `install_geimser.sh` si no existen).
- `docker-compose.override.yml`: build de la imagen custom (`docker/geimser-zammad/Dockerfile`) para cada servicio Zammad + servicio MeshCentral.
- `docker/geimser-zammad/Dockerfile`: hornea el overlay completo (CSS/JS/fuentes/logos/layout/controllers/initializers/routes) sobre la imagen oficial de Zammad.
- `branding/`: overlay fuente (`geimser.css`, `geimser.js`, `fonts/`, `layouts/application.html.erb`, `controllers/`, `initializers/`, `routes/`, `meshcentral/custom.js`).
- `scripts/configure_geimser.rb`: configuracion inicial dentro de Zammad (campo "Tipo de Servicio", campos MeshCentral).
- `scripts/install_geimser.sh`: genera secretos en `.env` si faltan, construye y levanta los servicios, aplica `configure_geimser.rb` y reinicia para servir el overlay.
- `scripts/check_frontend_safety.sh`: gate de calidad frontend (ver `docs/frontend-quality-gate.md`) que bloquea regresiones de contraste y rutas CMDB duplicadas antes de cada release.
- `tools/mercury_test.py`, `tools/mercury_zammad_config.py`: scripts sueltos de prueba/configuracion del proveedor IA Mercury (Inception Labs) en Zammad. Requieren `MERCURY_API_KEY` y `ZAMMAD_TOKEN` como variables de entorno — nunca hardcodeadas en el archivo.

## Campo personalizado

Se crea el campo de ticket `Tipo de Servicio` con estas opciones:

- Soporte Tecnico
- Consultoria
- Infraestructura
- Otros

Tambien se crean campos para soporte remoto:

- `ID Equipo MeshCentral`
- `Enlace Sesion Remota`

Estos campos permiten asociar un ticket con el equipo o sesion remota correspondiente en MeshCentral.

## RBAC operativo

Solo el rol con permiso `admin` puede ver y usar CMDB ITSM, Mapa Interactivo, Secretos Seguros, Toma Remota y administracion. Los roles `Agent`, `Client`, `Cliente`, `Customer` y cualquier rol sin permiso `admin` quedan limitados al flujo de tickets segun los permisos nativos de Zammad.

La restriccion se aplica en dos capas:

- Frontend: `branding/geimser.js` oculta accesos laterales y redirige hashes restringidos hacia `#ticket/view`.
- Backend: `GeimserRbac` bloquea APIs y endpoints propios de modulos Geimser para cualquier usuario sin permiso `admin`.

Las rutas publicas de lectura de Secretos Seguros siguen disponibles para destinatarios externos, porque no exigen sesion.

## Cierre de tickets

El overlay agrega `GeimserTicketClosure`, que reutiliza estados y scheduler nativos de Zammad.

- Cierre por confirmacion: si el cliente responde con una confirmacion clara de solucion, el ticket se cambia a estado cerrado, se registra auditoria y se envia correo.
- Cierre automatico: cuando un tecnico deja el ticket en `pending close`, `resolved` o `resuelto`, el sistema fija una ventana de 24 horas. Si no hay respuesta del cliente, el scheduler `Geimser: cerrar tickets resueltos inactivos` cierra el ticket automaticamente.
- Cierre manual: si un agente/admin cierra el ticket desde la UI, se registra auditoria y se envia correo de cierre.

La auditoria queda en la tabla `geimser_ticket_closure_audits` con:

- Ticket y numero.
- Tipo de cierre: `manual` o `automatic`.
- Disparador: confirmacion de cliente, cierre manual o inactividad.
- Fecha de cierre.
- Usuario que provoco el cierre.
- Estado y fecha de envio del correo.

Los correos HTML se renderizan desde plantillas en `app/views/geimser_ticket_closure_mailer/` dentro de la imagen Docker. El envio se ejecuta de forma asincrona con `GeimserTicketClosureMailJob` y usa el canal `Email::Notification` ya configurado por Zammad.

## Uso

Ejecuta:

```bash
./scripts/install_geimser.sh
```

Despues abre:

```text
http://localhost:8080
```

Administrador inicial local:

```text
Usuario: admin@geimser.local
Clave: la que el script genere/imprima (GEIMSER_ADMIN_PASSWORD), o la que ya exista en .env
```

`install_geimser.sh` genera `GEIMSER_ADMIN_PASSWORD` con `openssl rand` y la guarda en `.env` si no existe; no hay clave fija de fabrica. Para fijar una propia en una instalacion nueva:

```bash
GEIMSER_ADMIN_PASSWORD='una-clave-segura' ./scripts/install_geimser.sh
```

## Nota de mantenimiento

La personalizacion de nombre, empresa, idioma, zona horaria, logo y campo de ticket se aplica mediante configuracion de Zammad (`scripts/configure_geimser.rb`). El branding visual (CSS/JS/fuentes/layout) se hornea en la imagen Docker via `docker/geimser-zammad/Dockerfile` — no se modifica ni recompila el codigo fuente de Zammad directamente. Tras cualquier cambio en `branding/`, sube el numero de cache-bust `?v=N` en `branding/layouts/application.html.erb` y vuelve a ejecutar `./scripts/install_geimser.sh` (o `docker compose build && docker compose up -d`) para reconstruir la imagen y reaplicar la configuracion. Antes de cada release, corre `scripts/check_frontend_safety.sh` (ver `docs/frontend-quality-gate.md`).

## Deploy en AWS Lightsail

Desde AWS CloudShell:

```bash
git clone https://github.com/hhdev2026/ITSM_geimser.git
cd ITSM_geimser
chmod +x aws/deploy-lightsail-geimser.sh
REGION=us-east-1 BUNDLE_ID=large_3_0 ./aws/deploy-lightsail-geimser.sh
```

El script crea una instancia Lightsail Ubuntu 24.04, abre solo puertos 22/80/443, asigna una IP estatica, instala Docker y levanta ITSM Geimser. Si no se define `GEIMSER_ADMIN_PASSWORD`, genera una clave inicial aleatoria y la muestra al final del despliegue.

## MeshCentral

MeshCentral queda integrado como servicio Docker adicional para toma remota de equipos.

- Zammad: `http://IP_PUBLICA`
- MeshCentral: `https://IP_PUBLICA`
- Puerto publico MeshCentral: `443`
- Datos persistentes: volumen `meshcentral-data`
- Archivos persistentes: volumen `meshcentral-files`
- Backups persistentes: volumen `meshcentral-backups`

Por seguridad, el registro de usuarios queda cerrado por defecto:

```env
MESH_ALLOW_NEW_ACCOUNTS=false
```

El nombre visible de MeshCentral se controla desde `.env` y se reaplica cada vez que se ejecuta `configure_meshcentral.sh`:

```env
MESH_TITLE=Geimser ITSM
MESH_TITLE2=Centro remoto
```

El inicio automatico desde el ITSM depende de estas variables:

```env
MESH_PUBLIC_URL=https://remoto.geimser.cl
MESH_HOSTNAME=remoto.geimser.cl
MESH_LOGIN_USER=admin
MESH_LOGIN_KEY=<160 caracteres hexadecimales>
```

`MESH_LOGIN_KEY` debe ser exactamente la misma llave configurada en MeshCentral como `settings.logincookieencryptionkey`. El script `configure_meshcentral.sh` la aplica automaticamente al `config.json` de MeshCentral.

El usuario definido en `MESH_LOGIN_USER` debe existir dentro de MeshCentral. Para que el boton **Tomar Equipo** muestre los PCs del grupo QA en productivo, ese usuario debe ser administrador del sitio o tener permisos sobre ese grupo de dispositivos. Si el usuario existe pero no tiene acceso a QA, el login automatico funciona pero MeshCentral muestra **Mis Dispositivos** vacio.

Despues de cambiar esos valores, reaplica la configuracion sin borrar volumenes:

```bash
cd /opt/ITSM_geimser
sudo ./scripts/configure_meshcentral.sh
sudo docker compose up -d --force-recreate meshcentral
```

Para validar el usuario usado por el SSO:

```bash
cd /opt/ITSM_geimser
sudo docker compose exec -T meshcentral node /opt/meshcentral/meshcentral --listuserids
```

Debe aparecer `user//admin` si `MESH_LOGIN_USER=admin`. En una instalacion nueva, puedes crear y promover ese usuario con MeshCentral detenido:

```bash
cd /opt/ITSM_geimser
sudo docker compose stop meshcentral
sudo docker compose run --rm --entrypoint node meshcentral /opt/meshcentral/meshcentral --createaccount admin --pass 'CAMBIAR_ESTA_CLAVE' --name 'Geimser ITSM' --email admin@geimser.local
sudo docker compose run --rm --entrypoint node meshcentral /opt/meshcentral/meshcentral --adminaccount admin
sudo docker compose up -d meshcentral
```

Para crear el primer administrador en una instalacion nueva:

```bash
cd /opt/ITSM_geimser
sudo sed -i 's/^MESH_ALLOW_NEW_ACCOUNTS=.*/MESH_ALLOW_NEW_ACCOUNTS=true/' .env
sudo ./scripts/configure_meshcentral.sh
sudo docker compose up -d --force-recreate meshcentral
```

Luego abre `https://IP_PUBLICA`, registra el primer usuario administrador, y vuelve a cerrar el registro:

```bash
cd /opt/ITSM_geimser
sudo sed -i 's/^MESH_ALLOW_NEW_ACCOUNTS=.*/MESH_ALLOW_NEW_ACCOUNTS=false/' .env
sudo ./scripts/configure_meshcentral.sh
sudo docker compose up -d --force-recreate meshcentral
```

No uses `docker compose down -v`, porque eso borra volumenes persistentes.

## botITSM (chatbot omnicanal)

`botITSM/` es un **submodulo git** que apunta a `github-atlashh2fc:atlashh2fc-dev/botITSM.git` (Next.js, deploy en Vercel). Vive en una carpeta separada con su propio stack y su propio despliegue — no se construye ni se sirve junto a la imagen de Zammad. Crea tickets reales en este Zammad via API REST (token `BotITSM-Omnicanal`) y persiste memoria de conversacion en Supabase. Detalle en `botITSM/OMNICANAL.md` y `botITSM/AUDITORIA_AGENTE_IA.md`.

Al clonar este repo, inicializa el submodulo:

```bash
git submodule update --init --recursive
```
