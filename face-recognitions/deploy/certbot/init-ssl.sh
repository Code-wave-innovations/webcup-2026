#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

if [[ ! -f .env.prod ]]; then
  echo "Missing .env.prod — copy from .env.prod.example" >&2
  exit 1
fi
# Do NOT `source` .env.prod: values such as FACE_RATE_LIMIT=60 per minute are not valid bash.
# Read only the two keys we need.
read_env() {
  local key="$1" line val
  line="$(grep -E "^[[:space:]]*${key}=" .env.prod | tail -n 1 || true)"
  val="${line#*=}"
  val="${val%$'\r'}"
  # strip surrounding single/double quotes
  if [[ "$val" =~ ^\"(.*)\"$ ]] || [[ "$val" =~ ^\'(.*)\'$ ]]; then
    val="${BASH_REMATCH[1]}"
  fi
  printf '%s' "$val"
}

DOMAIN="$(read_env DOMAIN)"
LETSENCRYPT_EMAIL="$(read_env LETSENCRYPT_EMAIL)"
: "${DOMAIN:?DOMAIN missing in .env.prod}"
: "${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL missing in .env.prod}"

COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.prod)

echo "==> Starting duckdns + face-engine + nginx (HTTP bootstrap)"
"${COMPOSE[@]}" up -d duckdns face-engine nginx

echo "==> Waiting for nginx..."
sleep 3

echo "==> Requesting Let's Encrypt certificate for ${DOMAIN}"
"${COMPOSE[@]}" run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  -d "${DOMAIN}" \
  --email "${LETSENCRYPT_EMAIL}" \
  --agree-tos \
  --non-interactive \
  --keep-until-expiring \
  --rsa-key-size 4096

echo "==> Reloading nginx with TLS config"
"${COMPOSE[@]}" up -d --force-recreate nginx
# entrypoint picks SSL template once cert exists
"${COMPOSE[@]}" exec nginx nginx -s reload 2>/dev/null || true

echo "==> Done. Health: curl -fsS https://${DOMAIN}/health"
