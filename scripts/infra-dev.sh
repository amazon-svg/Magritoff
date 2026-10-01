#!/usr/bin/env bash
set -euo pipefail

MAGRIT_PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MAGRIT_COMPOSE_FILE="$MAGRIT_PROJECT_ROOT/compose.dev.yml"
MAGRIT_COMPOSE=(docker compose -f "$MAGRIT_COMPOSE_FILE" -p magritoff-dev)

cd "$MAGRIT_PROJECT_ROOT"

case "${1:-}" in
  up)
    "${MAGRIT_COMPOSE[@]}" up -d --wait --wait-timeout 60 postgres s3 mail
    node scripts/db/migrate.mjs
    node scripts/db/seed-development.mjs
    node scripts/infra/ensure-s3-buckets.mjs
    "${MAGRIT_COMPOSE[@]}" ps
    ;;
  down)
    "${MAGRIT_COMPOSE[@]}" down
    ;;
  status)
    "${MAGRIT_COMPOSE[@]}" ps
    ;;
  logs)
    "${MAGRIT_COMPOSE[@]}" logs --tail 200
    ;;
  config)
    "${MAGRIT_COMPOSE[@]}" config
    ;;
  env)
    echo 'DATABASE_URL=postgresql://magrit:magrit-local-only@127.0.0.1:55432/magrit'
    echo 'MAGRIT_DATABASE_MIGRATION_URL=postgresql://magrit:magrit-local-only@127.0.0.1:55432/magrit'
    echo 'S3_ENDPOINT=http://127.0.0.1:58333'
    echo 'S3_PUBLIC_BASE_URL=http://127.0.0.1:58333'
    echo 'S3_REGION=us-east-1'
    echo 'S3_ACCESS_KEY_ID=magrit-local'
    echo 'S3_SECRET_ACCESS_KEY=magrit-local-secret'
    echo 'S3_FORCE_PATH_STYLE=true'
    echo 'MAIL_HOST=127.0.0.1'
    echo 'MAIL_PORT=51025'
    echo 'MAIL_SECURE=false'
    echo "MAGRIT_FROM_EMAIL='Magrit <noreply@magrit.local>'"
    echo 'MAGRIT_DEV_USER_EMAIL=developer@magrit.local'
    echo 'MAGRIT_DEV_USER_PASSWORD=magrit-development-only'
    echo 'MAGRIT_DEV_TENANT_SLUG=magrit-development'
    echo 'MAGRIT_DEV_OIDC_ISSUER=http://127.0.0.1:5556/dex'
    echo 'MAGRIT_DEV_OIDC_SUBJECT=10000000-0000-4000-8000-000000000001'
    echo 'APP_BASE_URL=http://localhost:5176'
    echo 'MAGRIT_AUTH_SECRET=magrit-local-auth-secret-change-me-32chars'
    ;;
  reset)
    if [[ "${2:-}" != "--yes" ]]; then
      if [[ ! -t 0 ]]; then
        echo 'Refus du reset non interactif sans --yes.' >&2
        exit 2
      fi
      read -r -p 'Supprimer les volumes locaux PostgreSQL, S3 et Mailpit ? [y/N] ' MAGRIT_RESET_CONFIRMATION
      if [[ "$MAGRIT_RESET_CONFIRMATION" != "y" && "$MAGRIT_RESET_CONFIRMATION" != "Y" ]]; then
        echo 'Reset annule.'
        exit 0
      fi
    fi
    "${MAGRIT_COMPOSE[@]}" down --volumes --remove-orphans
    ;;
  *)
    echo 'Usage: ./scripts/infra-dev.sh {up|down|status|logs|config|env|reset [--yes]}' >&2
    exit 2
    ;;
esac
