#!/usr/bin/env bash
# Regenere src/types/database.types.ts depuis le projet Supabase B5
# (R4 - refacto 2026-05-11).
#
# Usage : SUPABASE_PAT=sbp_... pnpm db:types
#
# Le PAT est demande a Arnaud a chaque session (cf. CLAUDE.md). Sans variable
# d env, le script echoue proprement avec un message explicite.

set -euo pipefail

PROJECT_REF="ightkxebexuzfjdbpsdg"
OUTPUT="src/types/database.types.ts"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$PROJECT_ROOT"

if [[ -z "${SUPABASE_PAT:-}" ]]; then
  echo "❌ SUPABASE_PAT non defini. Demande le PAT a Arnaud puis :"
  echo "   SUPABASE_PAT=sbp_... pnpm db:types"
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"

echo "→ Generation types depuis Supabase Management API ($PROJECT_REF)..."
RAW=$(curl -fsS \
  "https://api.supabase.com/v1/projects/$PROJECT_REF/types/typescript?included_schemas=public" \
  -H "Authorization: Bearer $SUPABASE_PAT")

echo "$RAW" | python3 -c "import sys, json; print(json.load(sys.stdin)['types'])" > "$OUTPUT"

LINES=$(wc -l < "$OUTPUT" | tr -d ' ')
echo "✅ $OUTPUT regenere ($LINES lignes)"
