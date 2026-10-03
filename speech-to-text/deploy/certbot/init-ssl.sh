#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

if [[ ! -f .env.prod ]]; then
  echo "Missing .env.prod — copy from .env.prod.example" >&2
  exit 1
fi

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
HTTP_PORT="$(read_env HTTP_PORT)"
HTTP_PORT="${HTTP_PORT:-80}"
: "${DOMAIN:?DOMAIN missing in .env.prod}"
: "${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL missing in .env.prod}"

if [[ -z "${FORCE_HTTP}" && "${HTTP_PORT}" != "80" ]]; then
  FORCE_HTTP=1
  echo "==> Auto-enabling FORCE_HTTP=1 (HTTP_PORT=${HTTP_PORT})"
fi
export FORCE_HTTP

DOCKER=(docker)
if ! docker info >/dev/null 2>&1; then
  if sudo docker info >/dev/null 2>&1; then
    DOCKER=(sudo docker)
  else
    echo "Cannot reach Docker daemon" >&2
    exit 1
  fi
fi
COMPOSE=("${DOCKER[@]}" compose -f docker-compose.prod.yml --env-file .env.prod)

mkdir -p data/certbot-www data/letsencrypt

echo "==> Starting STT stack (HTTP bootstrap) FORCE_HTTP=${FORCE_HTTP:-0}"
"${COMPOSE[@]}" up -d postgres redis rabbitmq stt-api stt-worker duckdns nginx

echo "==> Waiting for nginx / API..."
sleep 5

if [[ "${FORCE_HTTP}" == "1" || "${FORCE_HTTP}" == "true" ]]; then
  echo "==> Installing host nginx HTTP proxy (phase 1)"
  sudo ./deploy/host-nginx/install-host-nginx.sh http || {
    echo "WARN: host nginx install failed" >&2
  }
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

sudo chmod -R a+rX data/letsencrypt/live data/letsencrypt/archive 2>/dev/null || true

if [[ "${FORCE_HTTP}" == "1" || "${FORCE_HTTP}" == "true" ]]; then
  echo "==> Switching host nginx to TLS (phase 2)"
  sudo ./deploy/host-nginx/install-host-nginx.sh ssl
  "${COMPOSE[@]}" up -d --force-recreate nginx stt-api
else
  echo "==> Reloading Docker nginx with TLS config"
  "${COMPOSE[@]}" up -d --force-recreate nginx
fi

echo "==> Checking Docker upstream on :${HTTP_PORT}"
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if curl -fsS "http://127.0.0.1:${HTTP_PORT}/health" >/dev/null; then
    echo "    OK (attempt ${i})"
    break
  fi
  echo "    waiting for STT stack… (${i}/12)"
  sleep 5
done

echo "==> Done. Health: curl -fsS https://${DOMAIN}/health"
curl -fsS "https://${DOMAIN}/health" || {
  echo "Public HTTPS still failing. Debug:" >&2
  echo "  ${DOCKER[*]} compose -f docker-compose.prod.yml --env-file .env.prod ps" >&2
  echo "  ${DOCKER[*]} compose -f docker-compose.prod.yml --env-file .env.prod logs --tail=80 nginx stt-api" >&2
  exit 1
}
