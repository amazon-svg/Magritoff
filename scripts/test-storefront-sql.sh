#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE_CONTAINER="supabase_db_magritoff-v5"

cd "$PROJECT_ROOT"

if ! docker inspect "$DATABASE_CONTAINER" >/dev/null 2>&1; then
  echo "Supabase local n'est pas démarré. Lancez : pnpm db:local:start" >&2
  exit 1
fi

# Cas SQL executes contre la base locale. Historiquement storefront ; le
# Sprint 5 y ajoute les cas Gestion commerciale, qui exigent le meme runtime
# (triggers et RLS reels, ce qu une lecture du fichier de migration ne teste
# pas).
SQL_CASES=(
  tests/sql/storefront-session-lifecycle.sql
  tests/sql/shop-customer-delegation.sql
  tests/sql/storefront-order-identity.sql
  tests/sql/storefront-portal-orders.sql
  tests/sql/storefront-order-drafts.sql
  tests/sql/storefront-order-cancellation.sql
  tests/sql/storefront-order-audit.sql
  tests/sql/legacy-shop-only-customer-migration.sql
  tests/sql/legacy-shop-only-write-freeze.sql
  tests/sql/storefront-credential-activation.sql
  tests/sql/storefront-self-registration.sql
  tests/sql/storefront-password-recovery.sql
  tests/sql/public-shop-tax-regime.sql
  tests/sql/gescom-outbox-append-only.sql
  tests/sql/gescom-e10-4-customers.sql
  tests/sql/gescom-e10-5-shop-customer-link.sql
  tests/sql/gescom-e10-1-projects.sql
  tests/sql/gescom-e10-2-project-tags.sql
)

for sql_case in "${SQL_CASES[@]}"; do
  echo "SQL: $sql_case"
  docker exec -i "$DATABASE_CONTAINER" \
    psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$sql_case"
done
