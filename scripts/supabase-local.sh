#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASELINE_SOURCE="$PROJECT_ROOT/supabase/_bootstrap_b4.sql"
BASELINE_MIGRATION="$PROJECT_ROOT/supabase/migrations/20260417000000_local_b4_baseline.sql"

cd "$PROJECT_ROOT"

with_local_baseline() {
  if [[ ! -f "$BASELINE_SOURCE" ]]; then
    echo "Baseline locale introuvable : $BASELINE_SOURCE" >&2
    exit 1
  fi

  awk '/^-- FILE: 20260418_library_client.sql/{exit} {print}' \
    "$BASELINE_SOURCE" > "$BASELINE_MIGRATION"
  trap 'rm -f "$BASELINE_MIGRATION"' EXIT INT TERM
  pnpm exec supabase "$@"
}

case "${1:-}" in
  start)
    with_local_baseline start
    ;;
  reset)
    with_local_baseline db reset --local
    ;;
  stop)
    pnpm exec supabase stop
    ;;
  status)
    pnpm exec supabase status
    ;;
  *)
    echo "Usage: $0 {start|reset|stop|status}" >&2
    exit 2
    ;;
esac
