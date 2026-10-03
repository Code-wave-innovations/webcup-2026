#!/bin/sh
set -eu

role="${1:-api}"

case "$role" in
  api)
    echo "==> prisma migrate deploy"
    npx prisma migrate deploy
    echo "==> starting STT API"
    exec node dist/index.js
    ;;
  worker)
    echo "==> starting STT worker"
    exec node dist/workers/transcription.worker.js
    ;;
  *)
    echo "Unknown role: $role (use api|worker)" >&2
    exit 1
    ;;
esac
