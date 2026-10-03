#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

if [[ ! -f .env.prod ]]; then
  echo "Missing .env.prod — copy from .env.prod.example" >&2
  exit 1
fi
# Do NOT `source` .env.prod: values such as FACE_RATE_LIMIT=60 per minute are not valid bash.
read_env() {
  local key="$1" line val
  line="$(grep -E "^[[:space:]]*${key}=" .env.prod | tail -n 1 || true)"
  val="${line#*=}"
  val="${val%$'\r'}"
  if [[ "$val" =~ ^\"(.*)\"$ ]] || [[ "$val" =~ ^\'(.*)\'$ ]]; then
    val="${BASH_REMATCH[1]}"
  fi
  printf '%s' "$val"
}

DOMAIN="$(read_env DOMAIN)"
LETSENCRYPT_EMAIL="$(read_env LETSENCRYPT_EMAIL)"
FORCE_HTTP="$(read_env FORCE_HTTP)"
: "${DOMAIN:?DOMAIN missing in .env.prod}"
: "${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL missing in .env.prod}"

COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.prod)

mkdir -p data/certbot-www data/letsencrypt

echo "==> Starting duckdns + face-engine + nginx (HTTP bootstrap)"
"${COMPOSE[@]}" up -d duckdns face-engine nginx

echo "==> Waiting for nginx..."
sleep 3

# Behind host nginx: ensure public :80 proxies to Docker before ACME
if [[ "${FORCE_HTTP}" == "1" || "${FORCE_HTTP}" == "true" ]]; then
  if [[ -x deploy/host-nginx/install-host-nginx.sh ]]; then
    echo "==> Installing host nginx HTTP proxy (phase 1)"
    sudo ./deploy/host-nginx/install-host-nginx.sh http || {
      echo "WARN: host nginx install failed — ensure port 80 proxies to Docker HTTP_PORT" >&2
    }
  fi
fi

echo "==> Requesting Let's Encrypt certificate for ${DOMAIN}"
"${COMPOSE[@]}" run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  -d "${DOMAIN}" \
  --email "${LETSENCRYPT_EMAIL}" \
  --agree-tos \
  --non-interactive \
  --keep-until-expiring \
  --rsa-key-size 4096

if [[ "${FORCE_HTTP}" == "1" || "${FORCE_HTTP}" == "true" ]]; then
  echo "==> Switching host nginx to TLS (phase 2) — Docker stays FORCE_HTTP"
  sudo ./deploy/host-nginx/install-host-nginx.sh ssl
  "${COMPOSE[@]}" up -d --force-recreate nginx
else
  echo "==> Reloading Docker nginx with TLS config"
  "${COMPOSE[@]}" up -d --force-recreate nginx
  "${COMPOSE[@]}" exec nginx nginx -s reload 2>/dev/null || true
fi

echo "==> Done. Health: curl -fsS https://${DOMAIN}/health"
