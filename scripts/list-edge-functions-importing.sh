#!/usr/bin/env bash
# list-edge-functions-importing.sh
#
# Liste les edge functions Supabase qui importent un module `_shared/<file>`.
# Sert à ne plus oublier de redéployer une edge function après modification
# d'un module partagé (cf. bug pim-ingest oublié 9 jours en Sprint 4 — rétro 2026-05-20).
#
# Usage :
#   scripts/list-edge-functions-importing.sh <fichier_shared>
#
# Exemples :
#   scripts/list-edge-functions-importing.sh anthropicClient.ts
#   scripts/list-edge-functions-importing.sh _shared/anthropicClient.ts
#   scripts/list-edge-functions-importing.sh llm_usage
#
# Output : 1 ligne par edge function qui importe le module, format :
#   <function_name>   <fichier source>:<ligne>   <import statement>
#
# Exit 0 si au moins 1 import trouvé, 1 si aucun.
#
# Référence DoD §5.2 principe #6 — sécurise les déploiements multi-edge-functions.

set -euo pipefail

if [ $# -lt 1 ]; then
  cat <<EOF
Usage : $0 <fichier_shared>

Exemples :
  $0 anthropicClient.ts
  $0 _shared/anthropicClient.ts
  $0 llm_usage

Le pattern matché : from "...(_shared/)?<fichier>(.ts)?"
EOF
  exit 2
fi

# Normalise l'input — accepte "anthropicClient.ts", "_shared/anthropicClient.ts",
# "anthropicClient" (sans .ts), etc.
INPUT="$1"
BASENAME=$(basename "$INPUT" .ts)

# Détecte la racine du repo (parent du dossier scripts)
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
FUNCTIONS_DIR="$REPO_ROOT/supabase/functions"

if [ ! -d "$FUNCTIONS_DIR" ]; then
  echo "ERREUR : $FUNCTIONS_DIR introuvable. Lance le script depuis la racine du repo Magrit." >&2
  exit 3
fi

# Pattern grep : matche `from "..._shared/<basename>..."` ou `import "..._shared/<basename>..."`
# Couvre les imports relatifs (`../_shared/...`) et avec extension `.ts` optionnelle.
PATTERN="(from|import)[[:space:]]*[\"']([^\"']*_shared/)?${BASENAME}(\\.ts)?[\"']"

# Scanne toutes les edge functions (un sous-dossier = une edge function), exclut _shared lui-même
FOUND=0
echo "# Edge functions Supabase qui importent '$BASENAME' :"
echo

for fn_dir in "$FUNCTIONS_DIR"/*/; do
  fn_name=$(basename "$fn_dir")
  # Ignore _shared lui-même
  if [ "$fn_name" = "_shared" ]; then
    continue
  fi

  # grep dans tous les .ts (récursif au cas où il y a des sous-dossiers, ex: mockup/templates)
  matches=$(grep -rnE "$PATTERN" "$fn_dir" --include='*.ts' 2>/dev/null || true)

  if [ -n "$matches" ]; then
    FOUND=$((FOUND + 1))
    echo "## $fn_name"
    # Affiche les matches avec chemin relatif au repo pour clickabilité IDE
    while IFS= read -r line; do
      rel_path=${line#"$REPO_ROOT/"}
      echo "  $rel_path"
    done <<< "$matches"
    echo
  fi
done

if [ $FOUND -eq 0 ]; then
  echo "(aucune edge function n'importe '$BASENAME')"
  echo
  echo "Commandes utiles si tu veux vérifier ailleurs :"
  echo "  grep -rnE \"$PATTERN\" $REPO_ROOT --include='*.ts'"
  exit 1
fi

# Récap pour copy-paste dans une checklist de redeploy
echo "─────────────────────────────────────────────────────────────────"
echo "Checklist redeploy après modif de '$BASENAME' :"
echo
for fn_dir in "$FUNCTIONS_DIR"/*/; do
  fn_name=$(basename "$fn_dir")
  if [ "$fn_name" = "_shared" ]; then continue; fi
  matches=$(grep -rnE "$PATTERN" "$fn_dir" --include='*.ts' 2>/dev/null || true)
  if [ -n "$matches" ]; then
    echo "  [ ] supabase functions deploy $fn_name --project-ref ightkxebexuzfjdbpsdg"
  fi
done

exit 0
