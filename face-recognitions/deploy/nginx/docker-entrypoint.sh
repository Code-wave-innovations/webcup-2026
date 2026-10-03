#!/bin/sh
set -eu
: "${DOMAIN:?DOMAIN is required}"

TEMPLATE_DIR=/etc/nginx/templates
OUT=/etc/nginx/conf.d/face.conf
CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

# FORCE_HTTP=1: TLS is terminated on the host reverse-proxy; stay on the HTTP
# template forever so host→docker:HTTP_PORT never hits a HTTPS redirect loop.
if [ "${FORCE_HTTP:-0}" = "1" ] || [ "${FORCE_HTTP:-}" = "true" ]; then
  envsubst '${DOMAIN}' < "$TEMPLATE_DIR/face.http.conf.template" > "$OUT"
elif [ -f "$CERT" ]; then
  envsubst '${DOMAIN}' < "$TEMPLATE_DIR/face.conf.template" > "$OUT"
else
  envsubst '${DOMAIN}' < "$TEMPLATE_DIR/face.http.conf.template" > "$OUT"
fi

# Drop the image's welcome server so it can't become the default server
rm -f /etc/nginx/conf.d/default.conf

nginx -t

# Pick up certs renewed by the certbot container (files change on the shared volume)
(while :; do sleep 12h; nginx -s reload || true; done) &

exec nginx -g 'daemon off;'
