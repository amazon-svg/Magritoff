#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ID="$(awk -F '"' '/^project_id = / { print $2; exit }' "$PROJECT_ROOT/supabase/config.toml")"
CONTAINER="supabase_edge_runtime_${PROJECT_ID}"
SINCE="${HOPSTUDIO_LOG_SINCE:-30m}"
FOLLOW=false
TRACE_ID="${HOPSTUDIO_TRACE_ID:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --follow)
      FOLLOW=true
      shift
      ;;
    --trace)
      TRACE_ID="${2:-}"
      if [[ -z "$TRACE_ID" ]]; then
        echo "Usage : $0 [--follow] [--trace <traceId>]" >&2
        exit 2
      fi
      shift 2
      ;;
    *)
      echo "Usage : $0 [--follow] [--trace <traceId>]" >&2
      exit 2
      ;;
  esac
done

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "Runtime Edge local introuvable : $CONTAINER" >&2
  exit 1
fi

args=(logs --timestamps --since "$SINCE")
if [[ "$FOLLOW" == "true" ]]; then
  args+=(--follow)
fi
args+=("$CONTAINER")

echo "Traces HopeStudio ($CONTAINER, depuis $SINCE)"
echo "Les secrets HTTP ne sont jamais journalises. Ctrl-C pour quitter."
if [[ -n "$TRACE_ID" ]]; then
  echo "Filtre traceId : $TRACE_ID"
fi

docker "${args[@]}" 2>&1 \
  | awk -v trace_id="$TRACE_ID" '
      /\[hopstudio-(trace|chat)/ {
        if (trace_id == "" || index($0, trace_id) > 0) {
          print
          fflush()
        }
      }
    '
