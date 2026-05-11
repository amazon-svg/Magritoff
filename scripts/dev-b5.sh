#!/usr/bin/env bash
# Lance le serveur Vite dev pour la branche beta/v5 sur le port 5177.
#
# Usage :
#   ./scripts/dev-b5.sh           # foreground (Ctrl-C pour stopper)
#   ./scripts/dev-b5.sh --bg      # background (logs dans /tmp/magrit-vite-5177.log)
#   ./scripts/dev-b5.sh --stop    # tue le serveur en cours si lancé
#   ./scripts/dev-b5.sh --status  # vérifie si le port 5177 est occupé
#
# Le script :
#   1. Libère le port 5177 s'il est occupé (kill clean)
#   2. Lance vite via pnpm avec --strictPort (échec si port pris au lieu de fallback)
#   3. Vérifie que le serveur répond (HTTP 200) dans les 10 secondes

set -euo pipefail

PORT=5177
LOG="/tmp/magrit-vite-${PORT}.log"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$PROJECT_ROOT"

free_port() {
  local pids
  pids=$(lsof -ti:"$PORT" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "→ Port $PORT occupé par PID $pids, libération…"
    echo "$pids" | xargs -r kill -9 2>/dev/null || true
    sleep 1
  fi
}

start_foreground() {
  free_port
  echo "→ Lancement Vite sur http://localhost:$PORT (foreground, Ctrl-C pour stopper)…"
  exec pnpm exec vite --port "$PORT" --strictPort
}

start_background() {
  free_port
  echo "→ Lancement Vite sur http://localhost:$PORT (background)…"
  nohup pnpm exec vite --port "$PORT" --strictPort > "$LOG" 2>&1 &
  local pid=$!
  echo "  PID $pid, logs : $LOG"
  # Attente jusqu'à 10s que le serveur réponde
  for i in {1..10}; do
    sleep 1
    if curl -sf "http://localhost:$PORT/" -o /dev/null 2>&1; then
      echo "✅ Vite up : http://localhost:$PORT"
      echo "→ Stopper : ./scripts/dev-b5.sh --stop"
      return 0
    fi
  done
  echo "⚠️  Le serveur n'a pas répondu en 10s. Tail des logs :"
  tail -20 "$LOG"
  return 1
}

stop_server() {
  local pids
  pids=$(lsof -ti:"$PORT" 2>/dev/null || true)
  if [[ -z "$pids" ]]; then
    echo "ℹ️  Aucun serveur sur le port $PORT."
    return 0
  fi
  echo "→ Stop des PID $pids sur port $PORT…"
  echo "$pids" | xargs -r kill -9 2>/dev/null || true
  echo "✅ Serveur stoppé."
}

status_server() {
  local pids
  pids=$(lsof -ti:"$PORT" 2>/dev/null || true)
  if [[ -z "$pids" ]]; then
    echo "❌ Aucun serveur sur le port $PORT."
    return 1
  fi
  echo "✅ Serveur actif sur http://localhost:$PORT (PID $pids)."
  if curl -sf "http://localhost:$PORT/" -o /dev/null 2>&1; then
    echo "   HTTP 200 OK."
  else
    echo "   ⚠️  Port occupé mais HTTP ne répond pas (process en cours de démarrage ?)."
  fi
}

case "${1:-}" in
  --bg|--background)
    start_background
    ;;
  --stop)
    stop_server
    ;;
  --status)
    status_server
    ;;
  --help|-h)
    grep '^#' "$0" | head -10
    ;;
  *)
    start_foreground
    ;;
esac
