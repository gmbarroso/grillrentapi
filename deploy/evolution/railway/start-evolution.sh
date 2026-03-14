#!/usr/bin/env sh
set -eu

# Railway injects PORT dynamically. Keep explicit fallback for local smoke tests.
export SERVER_TYPE="${SERVER_TYPE:-http}"
export SERVER_HOST="${SERVER_HOST:-0.0.0.0}"
export SERVER_PORT="${PORT:-${SERVER_PORT:-8080}}"
export PORT="${SERVER_PORT}"

echo "[railway-evolution] starting with SERVER_HOST=${SERVER_HOST} SERVER_PORT=${SERVER_PORT}"

# Some Evolution images can prioritize bundled .env values over runtime env vars.
# Move it out of the way so Railway Variables are the source of truth.
if [ -f .env ]; then
  mv .env .env.image-default
  echo "[railway-evolution] moved bundled .env -> .env.image-default to honor Railway variables"
fi

# Avoid boot-time stalls on Railway. Opt-in migration with RUN_DB_DEPLOY_ON_BOOT=true.
if [ "${RUN_DB_DEPLOY_ON_BOOT:-false}" = "true" ]; then
  echo "[railway-evolution] RUN_DB_DEPLOY_ON_BOOT=true; running 'npm run db:deploy'"
  if npm run db:deploy; then
    echo "[railway-evolution] db:deploy completed"
  else
    echo "[railway-evolution] warning: db:deploy failed"
    if [ "${DB_PUSH_FALLBACK_ON_DEPLOY_FAIL:-true}" = "true" ]; then
      echo "[railway-evolution] running fallback 'npx prisma db push --schema ./prisma/postgresql-schema.prisma'"
      if npx prisma db push --schema ./prisma/postgresql-schema.prisma; then
        echo "[railway-evolution] db push fallback completed"
      else
        echo "[railway-evolution] warning: db push fallback failed, continuing with start:prod"
      fi
    else
      echo "[railway-evolution] DB_PUSH_FALLBACK_ON_DEPLOY_FAIL=false; continuing with start:prod"
    fi
  fi
else
  echo "[railway-evolution] skipping db:deploy on boot (set RUN_DB_DEPLOY_ON_BOOT=true to enable)"
fi

echo "[railway-evolution] launching app via 'npm run start:prod'"
exec npm run start:prod
