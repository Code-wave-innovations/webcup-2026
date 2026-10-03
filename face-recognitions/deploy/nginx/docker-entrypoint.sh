#!/bin/sh
set -eu
: "${DOMAIN:?DOMAIN is required}"

TEMPLATE_DIR=/etc/nginx/templates
OUT=/etc/nginx/conf.d/face.conf
CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

if [ -f "$CERT" ]; then
  envsubst '${DOMAIN}' < "$TEMPLATE_DIR/face.conf.template" > "$OUT"
else
  envsubst '${DOMAIN}' < "$TEMPLATE_DIR/face.http.conf.template" > "$OUT"
fi

nginx -t
exec nginx -g 'daemon off;'
