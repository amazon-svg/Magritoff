#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE_CONTAINER="supabase_db_magritoff-v5"
SEED_ALL=false

if [[ $# -eq 0 ]]; then
  SEED_ALL=true
  TENANT_SLUG="pressetout"
  CUSTOMER_COUNT="100"
  ORDER_COUNT="200"
elif [[ "$1" == "--all" ]]; then
  SEED_ALL=true
  TENANT_SLUG="pressetout"
  CUSTOMER_COUNT="${2:-100}"
  ORDER_COUNT="${3:-200}"
else
  TENANT_SLUG="$1"
  CUSTOMER_COUNT="${2:-100}"
  ORDER_COUNT="${3:-200}"
fi

if [[ ! "$TENANT_SLUG" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "Slug tenant invalide: $TENANT_SLUG" >&2
  exit 2
fi

if [[ ! "$CUSTOMER_COUNT" =~ ^[0-9]+$ ]] || (( CUSTOMER_COUNT < 1 || CUSTOMER_COUNT > 5000 )); then
  echo "Le nombre de clients doit etre compris entre 1 et 5000." >&2
  exit 2
fi

if [[ ! "$ORDER_COUNT" =~ ^[0-9]+$ ]] || (( ORDER_COUNT < 1 || ORDER_COUNT > 10000 )); then
  echo "Le nombre de commandes doit etre compris entre 1 et 10000." >&2
  exit 2
fi

if ! docker inspect "$DATABASE_CONTAINER" >/dev/null 2>&1; then
  echo "Supabase local n'est pas demarre. Lancez : pnpm db:local:start" >&2
  exit 1
fi

cd "$PROJECT_ROOT"

docker exec -i "$DATABASE_CONTAINER" \
  psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
    -v tenant_slug="$TENANT_SLUG" \
    -v customer_count="$CUSTOMER_COUNT" \
    -v order_count="$ORDER_COUNT" \
    -v seed_all="$SEED_ALL" \
  < scripts/seed-ux-volume.sql
