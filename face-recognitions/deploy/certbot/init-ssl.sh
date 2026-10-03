#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

if [[ ! -f .env.prod ]]; then
  echo "Missing .env.prod — copy from .env.prod.example" >&2
  exit 1
fi
# shellcheck disable=SC1091
set -a
source .env.prod
set +a

: "${DOMAIN:?}"
: "${LETSENCRYPT_EMAIL:?}"

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
  --rsa-key-size 4096

echo "==> Reloading nginx with TLS config"
"${COMPOSE[@]}" up -d --force-recreate nginx
# entrypoint picks SSL template once cert exists
"${COMPOSE[@]}" exec nginx nginx -s reload 2>/dev/null || true

echo "==> Done. Health: curl -fsS https://${DOMAIN}/health"
