#!/usr/bin/env bash
# Regenere les types TypeScript de l API Magrit Core v1 DEPUIS le contrat
# OpenAPI (story E10.0, CA2). Le contrat est la source ; les types sont un
# artefact derive. Ne jamais editer le fichier genere a la main.
#
# Usage :
#   pnpm gen:api          # regenere le fichier
#   pnpm gen:api:check    # echoue si le fichier genere n est plus a jour (CI)

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACT="openapi/magrit-core.v1.yaml"
OUTPUT="src/platform/api/generated/magrit-core.v1.ts"

cd "$PROJECT_ROOT"

if [[ ! -f "$CONTRACT" ]]; then
  echo "❌ Contrat introuvable : $CONTRACT"
  exit 1
fi

CHECK_ONLY=0
if [[ "${1:-}" == "--check" ]]; then
  CHECK_ONLY=1
fi

mkdir -p "$(dirname "$OUTPUT")"

HEADER="/**
 * FICHIER GENERE — NE PAS EDITER A LA MAIN.
 *
 * Source : $CONTRACT
 * Regeneration : pnpm gen:api
 *
 * Story E10.0 CA2 : aucun DTO de l API Gestion commerciale n est ecrit a la
 * main des deux cotes. Les schemas Zod de src/modules/_shared/api/ valident a
 * l execution ; ces types-la verrouillent la compilation sur le contrat.
 */
"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

printf '%s' "$HEADER" > "$TMP"
pnpm exec openapi-typescript "$CONTRACT" \
  --root-types \
  --root-types-no-schema-prefix \
  >> "$TMP"

if [[ "$CHECK_ONLY" == "1" ]]; then
  if [[ ! -f "$OUTPUT" ]]; then
    echo "❌ $OUTPUT absent. Lancer : pnpm gen:api"
    exit 1
  fi
  if ! diff -q "$TMP" "$OUTPUT" > /dev/null; then
    echo "❌ $OUTPUT n est plus aligne sur $CONTRACT."
    echo "   Lancer : pnpm gen:api  puis committer le resultat."
    diff -u "$OUTPUT" "$TMP" | head -40
    exit 1
  fi
  echo "✅ Types generes alignes sur $CONTRACT"
  exit 0
fi

mv "$TMP" "$OUTPUT"
trap - EXIT

LINES=$(wc -l < "$OUTPUT" | tr -d ' ')
echo "✅ $OUTPUT regenere depuis $CONTRACT ($LINES lignes)"
