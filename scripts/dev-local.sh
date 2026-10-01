#!/usr/bin/env bash
set -euo pipefail

MAGRIT_PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$MAGRIT_PROJECT_ROOT"

./scripts/infra-dev.sh up

# Valeurs locales non sensibles, alignees sur compose.dev.yml et le seed.
export APP_BASE_URL="${APP_BASE_URL:-http://127.0.0.1:5176}"
export VITE_API_PROXY_TARGET="${VITE_API_PROXY_TARGET:-http://127.0.0.1:8787}"
export MAGRIT_AUTH_SECRET="${MAGRIT_AUTH_SECRET:-magrit-local-auth-secret-change-me-32chars}"
export S3_ENDPOINT="${S3_ENDPOINT:-http://127.0.0.1:58333}"
export S3_PUBLIC_BASE_URL="${S3_PUBLIC_BASE_URL:-http://127.0.0.1:58333}"
export S3_REGION="${S3_REGION:-us-east-1}"
export S3_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-magrit-local}"
export S3_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-magrit-local-secret}"
export S3_FORCE_PATH_STYLE="${S3_FORCE_PATH_STYLE:-true}"
export MAIL_HOST="${MAIL_HOST:-127.0.0.1}"
export MAIL_PORT="${MAIL_PORT:-51025}"
export MAIL_SECURE="${MAIL_SECURE:-false}"
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
