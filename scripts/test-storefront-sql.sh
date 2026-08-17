#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE_CONTAINER="supabase_db_magritoff-v5"

cd "$PROJECT_ROOT"

if ! docker inspect "$DATABASE_CONTAINER" >/dev/null 2>&1; then
  echo "Supabase local n'est pas démarré. Lancez : pnpm db:local:start" >&2
  exit 1
fi

SQL_CASES=(
  tests/sql/storefront-session-lifecycle.sql
  tests/sql/shop-customer-delegation.sql
  tests/sql/storefront-order-identity.sql
  tests/sql/storefront-portal-orders.sql
  tests/sql/storefront-order-drafts.sql
  tests/sql/storefront-order-cancellation.sql
  tests/sql/storefront-order-audit.sql
  tests/sql/legacy-shop-only-customer-migration.sql
)

for sql_case in "${SQL_CASES[@]}"; do
  echo "Storefront SQL: $sql_case"
  docker exec -i "$DATABASE_CONTAINER" \
    psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$sql_case"
done
