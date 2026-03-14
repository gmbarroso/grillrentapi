#!/usr/bin/env sh
set -eu

# Railway injects PORT dynamically. Keep explicit fallback for local smoke tests.
export SERVER_TYPE="${SERVER_TYPE:-http}"
export SERVER_HOST="${SERVER_HOST:-0.0.0.0}"
export SERVER_PORT="${PORT:-${SERVER_PORT:-8080}}"
export PORT="${SERVER_PORT}"

echo "[railway-evolution] starting with SERVER_HOST=${SERVER_HOST} SERVER_PORT=${SERVER_PORT}"

# Evolution image is built for production runtime. Use deploy+migrate then start:prod.
if npm run | grep -q "db:deploy"; then
  npm run db:deploy
fi

exec npm run start:prod
