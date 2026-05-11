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
ROUTES=(
  "$BASE_URL/login"
  "$BASE_URL/t/imprimerie-ipa/atelier"
  "$BASE_URL/shop/boutique-1"
)

OUTPUT="${1:-a11y-report.json}"
EXIT_CODE=0

echo "→ Scan axe-core sur 3 routes critiques ($BASE_URL)..."

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
  echo "✅ Aucune violation a11y detectee sur les 3 routes."
else
  echo "⚠️  Des violations a11y ont ete detectees. Voir les rapports JSON."
  echo "    (niveau Critical bloque la CI - Moderate/Minor remontes en visibilite)"
fi

exit $EXIT_CODE
