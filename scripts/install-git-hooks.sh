#!/usr/bin/env sh
set -eu

repository_root=$(git rev-parse --show-toplevel)
cd "$repository_root"

git_directory=$(git rev-parse --git-dir)
hooks_directory="$git_directory/hooks"
installed_hook="$hooks_directory/post-checkout"

mkdir -p "$hooks_directory"

if [ -f "$installed_hook" ] &&
   ! grep -q 'Magrit managed hook' "$installed_hook"; then
  echo "Un hook post-checkout non géré par Magrit existe déjà : $installed_hook" >&2
  echo "Fusionnez-le manuellement avec .githooks/post-checkout." >&2
  exit 1
fi

cp .githooks/post-checkout "$installed_hook"
chmod +x .githooks/post-checkout "$installed_hook"

# Une copie dans .git/hooks reste disponible même lorsqu'on rejoint une
# ancienne branche qui ne contient pas encore le dossier .githooks.
git config --local --unset core.hooksPath 2>/dev/null || true

echo "✅ Hooks Git Magrit activés pour ce dépôt."
