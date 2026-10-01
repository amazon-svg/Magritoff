#!/usr/bin/env bash
set -euo pipefail

MAGRIT_PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$MAGRIT_PROJECT_ROOT"

# Les outils de migration utilisent ces variables si elles existent. On les
# retire avant meme de preparer l'infrastructure locale afin qu'une valeur
# heritee d'un autre projet ou de l'ancienne stack ne soit jamais prioritaire.
unset DATABASE_URL MAGRIT_DATABASE_MIGRATION_URL

./scripts/infra-dev.sh up

# Le lanceur local est hermetique pour les services d'infrastructure : une
# ancienne DATABASE_URL ou un ancien proxy Supabase exporte dans le terminal
# ne doit jamais contaminer le demarrage. Les MAGRIT_DEV_* restent configurables
# et sont les seules entrees destinees a personnaliser compose.dev.yml.
# Vite expose l'application sous localhost. Better Auth valide strictement
# l'origine et les URL de retour : garder exactement le meme hote evite les
# refus "Invalid origin/callbackURL" et conserve le cookie de session apres
# la verification de l'adresse email.
export APP_BASE_URL="http://localhost:5176"
export VITE_API_PROXY_TARGET="http://127.0.0.1:8787"
export MAGRIT_API_HOST="127.0.0.1"
export MAGRIT_API_PORT="8787"
export MAGRIT_AUTH_SECRET="${MAGRIT_AUTH_SECRET:-magrit-local-auth-secret-change-me-32chars}"
export S3_ENDPOINT="http://127.0.0.1:${MAGRIT_DEV_S3_PORT:-58333}"
export S3_PUBLIC_BASE_URL="$S3_ENDPOINT"
export S3_REGION="${MAGRIT_DEV_S3_REGION:-us-east-1}"
export S3_ACCESS_KEY_ID="${MAGRIT_DEV_S3_ACCESS_KEY_ID:-magrit-local}"
export S3_SECRET_ACCESS_KEY="${MAGRIT_DEV_S3_SECRET_ACCESS_KEY:-magrit-local-secret}"
export S3_FORCE_PATH_STYLE="true"
export MAIL_HOST="127.0.0.1"
export MAIL_PORT="${MAGRIT_DEV_MAIL_SMTP_PORT:-51025}"
export MAIL_SECURE="false"
export MAGRIT_FROM_EMAIL="${MAGRIT_FROM_EMAIL:-Magrit <noreply@magrit.local>}"

MAGRIT_API_PID=''
MAGRIT_VITE_PID=''

cleanup() {
  if [[ -n "$MAGRIT_API_PID" ]]; then kill "$MAGRIT_API_PID" 2>/dev/null || true; fi
  if [[ -n "$MAGRIT_VITE_PID" ]]; then kill "$MAGRIT_VITE_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

pnpm api:dev &
MAGRIT_API_PID=$!
pnpm dev &
MAGRIT_VITE_PID=$!

wait "$MAGRIT_API_PID" "$MAGRIT_VITE_PID"
