#!/usr/bin/env bash
set -euo pipefail

REGION="${REGION:-us-east-1}"
INSTANCE_NAME="${INSTANCE_NAME:-itsm-geimser}"
STATIC_IP_NAME="${STATIC_IP_NAME:-itsm-geimser-ip}"
BUNDLE_ID="${BUNDLE_ID:-large_3_0}"
BLUEPRINT_ID="${BLUEPRINT_ID:-ubuntu_24_04}"
REPO_URL="${REPO_URL:-https://github.com/hhdev2026/ITSM_geimser.git}"
ADMIN_PASSWORD="${GEIMSER_ADMIN_PASSWORD:-GeimserM1!2026}"
KEY_PAIR_NAME="${KEY_PAIR_NAME:-${INSTANCE_NAME}-key}"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"

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
sed -i "s#platform: linux/arm64#platform: __DOCKER_PLATFORM__#g" docker-compose.override.yml

export GEIMSER_ADMIN_PASSWORD="__ADMIN_PASSWORD__"
./scripts/install_geimser.sh
EOF
)"

USER_DATA="${USER_DATA/__ADMIN_PASSWORD__/$ADMIN_PASSWORD}"
USER_DATA="${USER_DATA/__DOCKER_PLATFORM__/$DOCKER_PLATFORM}"

mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

if ! aws lightsail get-key-pair --region "$REGION" --key-pair-name "$KEY_PAIR_NAME" >/dev/null 2>&1; then
  echo "Creating Lightsail SSH key pair ${KEY_PAIR_NAME}..."
  aws lightsail create-key-pair \
    --region "$REGION" \
    --key-pair-name "$KEY_PAIR_NAME" \
    --output json > "/tmp/${KEY_PAIR_NAME}.json"
  PRIVATE_KEY_VALUE="$(jq -r '.privateKeyBase64 // .privateKey // empty' "/tmp/${KEY_PAIR_NAME}.json")"
  if printf '%s\n' "$PRIVATE_KEY_VALUE" | grep -q "BEGIN .*PRIVATE KEY"; then
    printf '%s\n' "$PRIVATE_KEY_VALUE" > "$HOME/.ssh/${KEY_PAIR_NAME}.pem"
  else
    printf '%s' "$PRIVATE_KEY_VALUE" | tr -d '\r\n"' | base64 --decode > "$HOME/.ssh/${KEY_PAIR_NAME}.pem"
  fi
  chmod 600 "$HOME/.ssh/${KEY_PAIR_NAME}.pem"
else
  echo "Lightsail SSH key pair ${KEY_PAIR_NAME} already exists."
  if [ ! -s "$HOME/.ssh/${KEY_PAIR_NAME}.pem" ]; then
    echo "Local private key $HOME/.ssh/${KEY_PAIR_NAME}.pem is missing. Delete the Lightsail key pair or choose a new KEY_PAIR_NAME." >&2
    exit 1
  fi
fi

echo "Checking Lightsail bundle and blueprint in ${REGION}..."
aws lightsail get-bundles --region "$REGION" --query "bundles[?bundleId=='${BUNDLE_ID}'].[bundleId,ramSizeInGb,price]" --output table
aws lightsail get-blueprints --region "$REGION" --query "blueprints[?blueprintId=='${BLUEPRINT_ID}'].[blueprintId,name]" --output table

echo "Creating Lightsail instance ${INSTANCE_NAME}..."
if aws lightsail get-instance --region "$REGION" --instance-name "$INSTANCE_NAME" >/dev/null 2>&1; then
  echo "Instance ${INSTANCE_NAME} already exists. Continuing with network setup..."
else
  aws lightsail create-instances \
    --region "$REGION" \
    --instance-names "$INSTANCE_NAME" \
    --availability-zone "${REGION}a" \
    --blueprint-id "$BLUEPRINT_ID" \
    --bundle-id "$BUNDLE_ID" \
    --key-pair-name "$KEY_PAIR_NAME" \
    --user-data "$USER_DATA"
fi

echo "Waiting for ${INSTANCE_NAME} to leave pending state..."
for _ in {1..60}; do
  STATE="$(aws lightsail get-instance --region "$REGION" --instance-name "$INSTANCE_NAME" --query 'instance.state.name' --output text)"
  echo "Current state: ${STATE}"
  if [ "$STATE" = "running" ]; then
    break
  fi
  sleep 10
done

if [ "${STATE:-unknown}" != "running" ]; then
  echo "Instance did not reach running state in time. Re-run this script in a few minutes." >&2
  exit 1
fi

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
ATTACHED_TO="$(aws lightsail get-static-ip --region "$REGION" --static-ip-name "$STATIC_IP_NAME" --query 'staticIp.attachedTo' --output text)"
if [ "$ATTACHED_TO" = "$INSTANCE_NAME" ]; then
  echo "Static IP ${STATIC_IP_NAME} is already attached to ${INSTANCE_NAME}."
else
  aws lightsail attach-static-ip \
    --region "$REGION" \
    --static-ip-name "$STATIC_IP_NAME" \
    --instance-name "$INSTANCE_NAME"
fi

PUBLIC_IP="$(aws lightsail get-static-ip --region "$REGION" --static-ip-name "$STATIC_IP_NAME" --query 'staticIp.ipAddress' --output text)"

cat <<EOF

Deploy iniciado.

URL: http://${PUBLIC_IP}
SSH/Logs:
  ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem ubuntu@${PUBLIC_IP}
  sudo tail -f /var/log/cloud-init-output.log

Credenciales Zammad:
  Usuario: admin@geimser.local
  Clave: ${ADMIN_PASSWORD}

EOF
