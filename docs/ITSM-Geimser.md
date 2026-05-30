# ITSM Geimser sobre Zammad

Esta carpeta contiene una instalacion Docker Compose de Zammad preparada para Apple Silicon/M1 y personalizada como **ITSM Geimser**.

## Origen y version

- Compose oficial: `https://github.com/zammad/zammad-docker-compose`
- Version fijada: `7.0.1-0048`
- Arquitectura: `linux/arm64`
- URL local: `http://localhost:8080`

## Marca aplicada

- Nombre de plataforma: `ITSM Geimser`
- Empresa: `Geimser`
- Logo: `branding/geimser-logo.png`
- Colores:
  - Azul principal: `#004B8D`
  - Azul secundario: `#1B3A6B`
  - Naranja acento: `#F5A623`
- Fuente preferida en CSS: Roboto, Open Sans, Lato, Arial, sans-serif
- Idioma: espanol Chile (`es-cl`)
- Zona horaria: `America/Santiago`

## Archivos agregados

- `.env`: variables locales de Zammad.
- `docker-compose.override.yml`: ajustes para Apple Silicon y montajes de marca.
- `branding/geimser.css`: estilos de color y fuente.
- `branding/nginx-geimser.conf`: configuracion Nginx para cargar el CSS de marca sin recompilar assets.
- `branding/geimser-logo.png`: logo descargado desde Geimser.
- `scripts/configure_geimser.rb`: configuracion inicial dentro de Zammad.
- `scripts/install_geimser.sh`: arranque, personalizacion y recompilacion de estilos.

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
Clave: GeimserM1!2026
```

Para usar otra clave en una instalacion nueva:

```bash
GEIMSER_ADMIN_PASSWORD='una-clave-segura' ./scripts/install_geimser.sh
```

## Nota de mantenimiento

La personalizacion de nombre, empresa, idioma, zona horaria, logo y campo de ticket se aplica mediante configuracion de Zammad. Los colores se sirven como CSS externo desde Nginx para evitar modificar o recompilar los assets internos de Zammad. Si se actualiza o recrea la imagen, vuelve a ejecutar `./scripts/install_geimser.sh` para reaplicar la configuracion.

## Deploy en AWS Lightsail

Desde AWS CloudShell:

```bash
git clone https://github.com/hhdev2026/ITSM_geimser.git
cd ITSM_geimser
chmod +x aws/deploy-lightsail-geimser.sh
REGION=us-east-1 BUNDLE_ID=large_3_0 ./aws/deploy-lightsail-geimser.sh
```

El script crea una instancia Lightsail Ubuntu 24.04, abre puertos 22/80/443/8080, asigna una IP estatica, instala Docker y levanta ITSM Geimser.

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

Para crear el primer administrador en una instalacion nueva:

```bash
cd /opt/ITSM_geimser
sudo sed -i 's/^MESH_ALLOW_NEW_ACCOUNTS=.*/MESH_ALLOW_NEW_ACCOUNTS=true/' .env
sudo docker compose up -d --force-recreate meshcentral
```

Luego abre `https://IP_PUBLICA`, registra el primer usuario administrador, y vuelve a cerrar el registro:

```bash
cd /opt/ITSM_geimser
sudo sed -i 's/^MESH_ALLOW_NEW_ACCOUNTS=.*/MESH_ALLOW_NEW_ACCOUNTS=false/' .env
sudo docker compose up -d --force-recreate meshcentral
```

No uses `docker compose down -v`, porque eso borra volumenes persistentes.
