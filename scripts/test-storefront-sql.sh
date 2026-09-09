#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE_CONTAINER="supabase_db_magritoff-v5"

cd "$PROJECT_ROOT"

if ! docker inspect "$DATABASE_CONTAINER" >/dev/null 2>&1; then
  echo "Supabase local n'est pas démarré. Lancez : pnpm db:local:start" >&2
  exit 1
fi

# `gescom-e10-12-quote-conversion.sql` (scenario 11, qa-review round 1
# correctif B1) a besoin de DEUX connexions Postgres reellement separees
# (extension dblink) pour reproduire une course entre deux transactions —
# impossible depuis une seule session psql. Adresse IP et mot de passe du
# conteneur local, lus DYNAMIQUEMENT (jamais en dur : aucun secret commis).
DBLINK_HOST="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$DATABASE_CONTAINER")"
DBLINK_PASSWORD="$(docker exec "$DATABASE_CONTAINER" printenv POSTGRES_PASSWORD)"

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
  tests/sql/gescom-e10-3-commercial-quotes.sql
  tests/sql/gescom-e10-6-price-rules.sql
  tests/sql/gescom-e10-7-price-rules-resolve.sql
  tests/sql/gescom-devis-unification-pim-triggers.sql
  tests/sql/gescom-e10-9-quote-line-discounts.sql
  tests/sql/gescom-e10-11-can-manage-pricing.sql
  tests/sql/gescom-e10-10a-quote-send-duplicate.sql
  tests/sql/gescom-e10-10b-1-storefront-quotes.sql
  tests/sql/gescom-e10-10b-2-storefront-quote-decision.sql
  tests/sql/gescom-e10-10b-3-outbox-dispatcher.sql
  tests/sql/gescom-e10-12-quote-conversion.sql
  tests/sql/gescom-e10-13-production-steps.sql
  tests/sql/gescom-e10-14-order-step-changes.sql
  tests/sql/gescom-e10-16-order-contact-and-delivery.sql
)

for sql_case in "${SQL_CASES[@]}"; do
  echo "SQL: $sql_case"
  docker exec -i "$DATABASE_CONTAINER" \
    psql -v ON_ERROR_STOP=1 -v dblink_host="$DBLINK_HOST" -v dblink_password="$DBLINK_PASSWORD" \
    -U postgres -d postgres < "$sql_case"
done
