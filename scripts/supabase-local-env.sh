#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

STATUS_ENV="$(pnpm exec supabase status -o env)"

read_value() {
  local name="$1"
  printf '%s\n' "$STATUS_ENV" \
    | sed -n "s/^${name}=\"\(.*\)\"$/\1/p" \
    | head -1
}

API_URL="$(read_value API_URL)"
ANON_KEY="$(read_value ANON_KEY)"

if [[ -z "$API_URL" || -z "$ANON_KEY" ]]; then
  echo "Impossible de lire API_URL ou ANON_KEY. Lancez d abord pnpm db:local:start." >&2
  exit 1
fi

umask 077
{
  printf 'VITE_SUPABASE_URL=%s\n' "$API_URL"
  printf 'VITE_SUPABASE_ANON_KEY=%s\n' "$ANON_KEY"
  printf 'VITE_API_RUNTIME=edge\n'
  printf 'VITE_API_PROXY_TARGET=%s/functions/v1/magrit-api\n' "$API_URL"
} > .env.local

echo "Configuration locale écrite dans .env.local."
