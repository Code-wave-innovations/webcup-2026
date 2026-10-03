#!/bin/sh
set -eu
: "${DOMAIN:?DOMAIN is required}"

TEMPLATE_DIR=/etc/nginx/templates
OUT=/etc/nginx/conf.d/stt.conf
CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

# FORCE_HTTP=1: TLS on host reverse-proxy; keep Docker nginx HTTP-only.
if [ "${FORCE_HTTP:-0}" = "1" ] || [ "${FORCE_HTTP:-}" = "true" ]; then
  envsubst '${DOMAIN}' < "$TEMPLATE_DIR/stt.http.conf.template" > "$OUT"
elif [ -f "$CERT" ]; then
  envsubst '${DOMAIN}' < "$TEMPLATE_DIR/stt.conf.template" > "$OUT"
else
  envsubst '${DOMAIN}' < "$TEMPLATE_DIR/stt.http.conf.template" > "$OUT"
fi

rm -f /etc/nginx/conf.d/default.conf
nginx -t
(while :; do sleep 12h; nginx -s reload || true; done) &
exec nginx -g 'daemon off;'
