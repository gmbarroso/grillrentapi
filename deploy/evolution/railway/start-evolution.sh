#!/usr/bin/env sh
set -eu

# Railway injects PORT dynamically. Keep explicit fallback for local smoke tests.
export SERVER_TYPE="${SERVER_TYPE:-http}"
export SERVER_HOST="${SERVER_HOST:-0.0.0.0}"
export SERVER_PORT="${PORT:-${SERVER_PORT:-8080}}"
export PORT="${SERVER_PORT}"

echo "[railway-evolution] starting with SERVER_HOST=${SERVER_HOST} SERVER_PORT=${SERVER_PORT}"

# Evolution image is built for production runtime. Try migrations, but do not block startup.
if npm run | grep -q "db:deploy"; then
  echo "[railway-evolution] running database deployment via 'npm run db:deploy'"
  if npm run db:deploy; then
    echo "[railway-evolution] db:deploy completed"
  else
    echo "[railway-evolution] warning: db:deploy failed, continuing with start:prod"
  fi
else
  echo "[railway-evolution] skipping database deployment (no 'db:deploy' npm script found)"
fi

echo "[railway-evolution] launching app via 'npm run start:prod'"
exec npm run start:prod
