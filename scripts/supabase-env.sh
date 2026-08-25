#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_FILE="$PROJECT_ROOT/.env.local"
OFFICIAL_FILE="$PROJECT_ROOT/.env.supabase-official"

read_env_value() {
  local content="$1"
  local name="$2"

  printf '%s\n' "$content" \
    | sed -n "s/^${name}=\"\{0,1\}\([^\"]*\)\"\{0,1\}$/\1/p" \
    | head -1
}

write_profile() {
  local profile="$1"
  local api_url="$2"
  local anon_key="$3"
  local proxy_target="$4"
  local temporary_file

  temporary_file="$(mktemp "$PROJECT_ROOT/.env.local.tmp.XXXXXX")"
  trap 'rm -f "$temporary_file"' EXIT INT TERM

  umask 077
  if [[ -f "$TARGET_FILE" ]]; then
    awk '!/^(VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY|VITE_API_PROXY_TARGET)=/' \
      "$TARGET_FILE" > "$temporary_file"
  fi

  {
    printf 'VITE_SUPABASE_URL=%s\n' "$api_url"
    printf 'VITE_SUPABASE_ANON_KEY=%s\n' "$anon_key"
    printf 'VITE_API_PROXY_TARGET=%s\n' "$proxy_target"
  } >> "$temporary_file"

  mv "$temporary_file" "$TARGET_FILE"
  trap - EXIT INT TERM

  echo "✅ Supabase actif : $profile ($api_url)"
  echo "   Redémarrez Vite s'il était déjà lancé."
}

use_local() {
  local status_env api_url anon_key

  if ! status_env="$(cd "$PROJECT_ROOT" && pnpm exec supabase status -o env 2>/dev/null)"; then
    echo "Supabase local n'est pas démarré. Lancez d'abord : pnpm db:local:start" >&2
    exit 1
  fi

  api_url="$(read_env_value "$status_env" API_URL)"
  anon_key="$(read_env_value "$status_env" ANON_KEY)"

  if [[ -z "$api_url" || -z "$anon_key" ]]; then
    echo "Impossible de lire API_URL ou ANON_KEY depuis Supabase local." >&2
    exit 1
  fi

  write_profile "local" "$api_url" "$anon_key" "$api_url/functions/v1/magrit-api"
}

use_official() {
  local official_env api_url anon_key proxy_target

  if [[ ! -f "$OFFICIAL_FILE" ]]; then
    echo "Configuration officielle introuvable : $OFFICIAL_FILE" >&2
    exit 1
  fi

  official_env="$(sed '/^[[:space:]]*#/d; /^[[:space:]]*$/d' "$OFFICIAL_FILE")"
  api_url="$(read_env_value "$official_env" VITE_SUPABASE_URL)"
  anon_key="$(read_env_value "$official_env" VITE_SUPABASE_ANON_KEY)"
  proxy_target="$(read_env_value "$official_env" VITE_API_PROXY_TARGET)"

  if [[ -z "$api_url" || -z "$anon_key" || -z "$proxy_target" ]]; then
    echo "La configuration Supabase officielle est incomplète." >&2
    exit 1
  fi

  write_profile "officiel" "$api_url" "$anon_key" "$proxy_target"
}

show_status() {
  local api_url

  if [[ ! -f "$TARGET_FILE" ]]; then
    echo "Supabase actif : officiel (configuration par défaut de l'application)"
    exit 0
  fi

  api_url="$(sed -n 's/^VITE_SUPABASE_URL=//p' "$TARGET_FILE" | tail -1)"

  case "$api_url" in
    http://127.0.0.1:*|http://localhost:*)
      echo "Supabase actif : local ($api_url)"
      ;;
    https://*.supabase.co)
      echo "Supabase actif : officiel ($api_url)"
      ;;
    '')
      echo "Supabase actif : officiel (configuration par défaut de l'application)"
      ;;
    *)
      echo "Supabase actif : personnalisé ($api_url)"
      ;;
  esac
}

case "${1:-}" in
  local)
    use_local
    ;;
  official)
    use_official
    ;;
  status)
    show_status
    ;;
  *)
    echo "Usage: $0 {local|official|status}" >&2
    exit 2
    ;;
esac
