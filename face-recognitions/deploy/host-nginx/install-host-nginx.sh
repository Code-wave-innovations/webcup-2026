#!/usr/bin/env bash
# Install / refresh the host nginx site that reverse-proxies to Docker (option 2).
set -euo pipefail
cd "$(dirname "$0")/../.."

if [[ ! -f .env.prod ]]; then
  echo "Missing .env.prod" >&2
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
HTTP_PORT="$(read_env HTTP_PORT)"
HTTP_PORT="${HTTP_PORT:-84}"
: "${DOMAIN:?DOMAIN missing in .env.prod}"

CERT_ROOT="$(pwd)/data/letsencrypt"
SITE_AVAILABLE="/etc/nginx/sites-available/face-api.conf"
SITE_ENABLED="/etc/nginx/sites-enabled/face-api.conf"
MODE="${1:-auto}" # auto | http | ssl

if [[ "$MODE" == "auto" ]]; then
  if [[ -f "${CERT_ROOT}/live/${DOMAIN}/fullchain.pem" ]]; then
    MODE=ssl
  else
    MODE=http
  fi
fi

if [[ "$MODE" == "ssl" ]]; then
  SRC=deploy/host-nginx/face-api.ssl.conf.template
else
  SRC=deploy/host-nginx/face-api.http.conf.template
fi

echo "==> Installing host nginx site (${MODE}) for ${DOMAIN} → 127.0.0.1:${HTTP_PORT}"
TMP="$(mktemp)"
sed -e "s|__DOMAIN__|${DOMAIN}|g" \
    -e "s|__HTTP_PORT__|${HTTP_PORT}|g" \
    -e "s|__CERT_ROOT__|${CERT_ROOT}|g" \
    "$SRC" > "$TMP"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Re-run with sudo to write ${SITE_AVAILABLE}" >&2
  echo "Preview written to ${TMP}"
  exit 1
fi

install -m 644 "$TMP" "$SITE_AVAILABLE"
rm -f "$TMP"
ln -sfn "$SITE_AVAILABLE" "$SITE_ENABLED"

# Avoid default site stealing :80 if present
if [[ -L /etc/nginx/sites-enabled/default ]]; then
  echo "==> Disabling /etc/nginx/sites-enabled/default (was catching :80)"
  rm -f /etc/nginx/sites-enabled/default
fi

nginx -t
systemctl reload nginx
echo "==> Host nginx reloaded (${MODE})"
