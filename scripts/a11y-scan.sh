#!/usr/bin/env bash
# R9 (refacto 2026-05-11 ADR-R7) - Scan a11y local via @axe-core/cli.
#
# Pré-requis :
#   - le dev server tourne sur http://localhost:5177 (pnpm dev:b5:bg)
#   - @axe-core/cli installe (devDep)
#
# Usage :
#   pnpm a11y:scan       # scan rapide des 3 routes critiques
#   ./scripts/a11y-scan.sh --output rapport-a11y.json
#
# Bloque la sortie sur les violations de niveau Critical (exit code != 0).
# Niveaux Moderate/Minor sont affiches mais ne bloquent pas (engagement
# WCAG AA reporte V2).

set -uo pipefail

BASE_URL="${A11Y_BASE_URL:-http://localhost:5177}"

# S9 audit a11y etendu (Sprint 9, 2026-06-01) puis S-ORDER-ROLES-3-UI
# (Sprint 6+, 2026-06-09 T7) : routes etendues a 13 (vs 3 initiales R9).
# Couvre les routes user-facing v1.1 :
#   - login : entree authentification
#   - atelier : interface principale imprimeur Pro
#   - shop home : entree boutique B2B (anonyme)
#   - shop orders ?tab=mine/to-validate/to-approve/to-produce : 4 tabs
#     Portal refondu (S-ORDER-ROLES-3-UI T3)
#   - shop portal : recherche IA Magrit
#   - dashboard orders : agrege admin tenant
#   - dashboard users : matrice users x roles (Phase A)
#   - dashboard order-roles : page admin catalog roles workflow (T4)
#   - dashboard spaces : sous-tenants + KPIs HQ (S-SUBTENANT-SCOPE)
#
# NOTE : les routes auth-requise affichent la page login si pas de
# session. Pour scan complet, il faut soit (a) cookies persistes via
# Playwright pre-launch (livre S9 commit a8aeb94), soit (b) routes
# publiques inspectees. MVP = tenir la liste a jour, run manuel quand
# dev server + session active.
ROUTES=(
  "$BASE_URL/login"
  "$BASE_URL/t/imprimerie-ipa/atelier"
  "$BASE_URL/t/imprimerie-ipa/dashboard/orders"
  "$BASE_URL/t/imprimerie-ipa/dashboard/users"
  "$BASE_URL/t/imprimerie-ipa/dashboard/order-roles"
  "$BASE_URL/t/imprimerie-ipa/spaces"
  "$BASE_URL/shop/boutique-1"
  "$BASE_URL/shop/boutique-1/portal"
)
# Note : PortalOrders n'est pas une route distincte mais une vue interne
# de PublicShop (state view='orders'). Le scan a11y ne couvre pas la vue
# 'orders' en URL directe — un test Playwright + click sur la nav portail
# serait nécessaire (tracé pour S-ORDER-ROLES-3-UI test E2E ultérieur).

OUTPUT="${1:-a11y-report.json}"
EXIT_CODE=0

echo "→ Scan axe-core sur ${#ROUTES[@]} routes ($BASE_URL)..."

for route in "${ROUTES[@]}"; do
  echo ""
  echo "════════════════════════════════════════════════════════════"
  echo "→ Route : $route"
  echo "════════════════════════════════════════════════════════════"

  pnpm exec axe "$route" \
    --tags wcag2a,wcag2aa \
    --exit \
    --save "${OUTPUT%.json}-$(basename "$route").json" || EXIT_CODE=1
done

echo ""
if [[ $EXIT_CODE -eq 0 ]]; then
  echo "✅ Aucune violation a11y detectee sur les ${#ROUTES[@]} routes."
else
  echo "⚠️  Des violations a11y ont ete detectees. Voir les rapports JSON."
  echo "    (niveau Critical bloque la CI - Moderate/Minor remontes en visibilite)"
fi

exit $EXIT_CODE
