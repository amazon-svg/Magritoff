#!/usr/bin/env sh
set -eu

repository_root=$(git rev-parse --show-toplevel)
cd "$repository_root"

git_directory=$(git rev-parse --git-dir)
hooks_directory="$git_directory/hooks"
mkdir -p "$hooks_directory"

managed_hooks="post-checkout post-rewrite pre-push"

# Vérifier toutes les collisions avant la première copie pour ne jamais laisser
# une installation partielle.
for hook_name in $managed_hooks; do
  installed_hook="$hooks_directory/$hook_name"
  if [ -f "$installed_hook" ] &&
     ! grep -q 'Magrit managed hook' "$installed_hook"; then
    echo "Un hook $hook_name non géré par Magrit existe déjà : $installed_hook" >&2
    echo "Fusionnez-le manuellement avec .githooks/$hook_name." >&2
    exit 1
  fi
done

for hook_name in $managed_hooks; do
  installed_hook="$hooks_directory/$hook_name"
  cp ".githooks/$hook_name" "$installed_hook"
  chmod +x ".githooks/$hook_name" "$installed_hook"
done

# Une copie dans .git/hooks reste disponible même lorsqu'on rejoint une
# ancienne branche qui ne contient pas encore le dossier .githooks.
git config --local --unset core.hooksPath 2>/dev/null || true

echo "✅ Hooks Git Magrit activés : changement de branche, rebase et contrôle avant push."
