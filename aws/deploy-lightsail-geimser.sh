#!/usr/bin/env bash
set -euo pipefail

REGION="${REGION:-us-east-1}"
INSTANCE_NAME="${INSTANCE_NAME:-itsm-geimser}"
STATIC_IP_NAME="${STATIC_IP_NAME:-itsm-geimser-ip}"
BUNDLE_ID="${BUNDLE_ID:-large_3_0}"
BLUEPRINT_ID="${BLUEPRINT_ID:-ubuntu_24_04}"
REPO_URL="${REPO_URL:-https://github.com/hhdev2026/ITSM_geimser.git}"
ADMIN_PASSWORD="${GEIMSER_ADMIN_PASSWORD:-GeimserM1!2026}"

USER_DATA="$(cat <<'EOF'
#!/usr/bin/env bash
set -euxo pipefail

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl git docker.io docker-compose-v2

systemctl enable --now docker

cat >/usr/local/bin/docker-compose <<'COMPOSE'
#!/usr/bin/env bash
exec docker compose "$@"
COMPOSE
chmod +x /usr/local/bin/docker-compose

sysctl -w vm.max_map_count=262144
cat >/etc/sysctl.d/99-zammad.conf <<'SYSCTL'
vm.max_map_count=262144
SYSCTL

cd /opt
rm -rf ITSM_geimser
git clone https://github.com/hhdev2026/ITSM_geimser.git
cd ITSM_geimser

PUBLIC_IP="$(curl -fsS http://169.254.169.254/latest/meta-data/public-ipv4 || true)"

sed -i 's/^NGINX_EXPOSE_PORT=.*/NGINX_EXPOSE_PORT=80/' .env
sed -i 's/^NGINX_SERVER_NAME=.*/NGINX_SERVER_NAME=_/' .env
sed -i "s/^ZAMMAD_FQDN=.*/ZAMMAD_FQDN=${PUBLIC_IP:-localhost}/" .env

export GEIMSER_ADMIN_PASSWORD="__ADMIN_PASSWORD__"
./scripts/install_geimser.sh
EOF
)"

USER_DATA="${USER_DATA/__ADMIN_PASSWORD__/$ADMIN_PASSWORD}"

echo "Checking Lightsail bundle and blueprint in ${REGION}..."
aws lightsail get-bundles --region "$REGION" --query "bundles[?bundleId=='${BUNDLE_ID}'].[bundleId,ramSizeInGb,price]" --output table
aws lightsail get-blueprints --region "$REGION" --query "blueprints[?blueprintId=='${BLUEPRINT_ID}'].[blueprintId,name]" --output table

echo "Creating Lightsail instance ${INSTANCE_NAME}..."
aws lightsail create-instances \
  --region "$REGION" \
  --instance-names "$INSTANCE_NAME" \
  --availability-zone "${REGION}a" \
  --blueprint-id "$BLUEPRINT_ID" \
  --bundle-id "$BUNDLE_ID" \
  --user-data "$USER_DATA"

echo "Opening ports 22, 80, 443 and 8080..."
aws lightsail put-instance-public-ports \
  --region "$REGION" \
  --instance-name "$INSTANCE_NAME" \
  --port-infos \
    fromPort=22,toPort=22,protocol=TCP \
    fromPort=80,toPort=80,protocol=TCP \
    fromPort=443,toPort=443,protocol=TCP \
    fromPort=8080,toPort=8080,protocol=TCP

echo "Allocating and attaching static IP..."
if ! aws lightsail get-static-ip --region "$REGION" --static-ip-name "$STATIC_IP_NAME" >/dev/null 2>&1; then
  aws lightsail allocate-static-ip --region "$REGION" --static-ip-name "$STATIC_IP_NAME"
fi
aws lightsail attach-static-ip \
  --region "$REGION" \
  --static-ip-name "$STATIC_IP_NAME" \
  --instance-name "$INSTANCE_NAME"

PUBLIC_IP="$(aws lightsail get-static-ip --region "$REGION" --static-ip-name "$STATIC_IP_NAME" --query 'staticIp.ipAddress' --output text)"

cat <<EOF

Deploy iniciado.

URL: http://${PUBLIC_IP}
SSH/Logs:
  aws lightsail get-instance-access-details --region ${REGION} --instance-name ${INSTANCE_NAME}
  ssh ubuntu@${PUBLIC_IP}
  sudo tail -f /var/log/cloud-init-output.log

Credenciales Zammad:
  Usuario: admin@geimser.local
  Clave: ${ADMIN_PASSWORD}

EOF
