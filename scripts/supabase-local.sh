#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASELINE_SOURCE="$PROJECT_ROOT/supabase/_bootstrap_b4.sql"
BASELINE_MIGRATION="$PROJECT_ROOT/supabase/migrations/20260417000000_local_b4_baseline.sql"
PROJECT_ID="$(awk -F '"' '/^project_id = / { print $2; exit }' "$PROJECT_ROOT/supabase/config.toml")"

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

ensure_edge_runtime() {
  local container="supabase_edge_runtime_${PROJECT_ID}"

  if ! docker inspect "$container" >/dev/null 2>&1; then
    echo "Edge Runtime local introuvable : $container" >&2
    return 1
  fi

  if [[ "$(docker inspect --format '{{.State.Running}}' "$container")" != "true" ]]; then
    echo "→ Edge Runtime arrêté, redémarrage ciblé…"
    docker start "$container" >/dev/null
  fi

  echo "✅ Edge Runtime actif : $container"
}

case "${1:-}" in
  start)
    with_local_baseline start
    ensure_edge_runtime
    ;;
  reset)
    with_local_baseline db reset --local
    ;;
  push)
    with_local_baseline db push --local
    ;;
  push-all)
    with_local_baseline db push --local --include-all
    ;;
  repair-baseline)
    with_local_baseline migration repair --local --status applied 20260417000000
    ;;
  stop)
    pnpm exec supabase stop
    ;;
  status)
    pnpm exec supabase status
    ;;
  *)
    echo "Usage: $0 {start|reset|push|push-all|repair-baseline|stop|status}" >&2
    exit 2
    ;;
esac
