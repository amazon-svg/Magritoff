#!/usr/bin/env bash
# A utiliser comme commande forcee dans authorized_keys pour la cle de la CI.
set -euo pipefail
if [[ "${SSH_ORIGINAL_COMMAND:-}" =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
  exec bash /opt/magritoff-preprod/scripts/preprod/deploy-commit.sh "${BASH_REMATCH[1]}"
fi
echo 'Cette cle autorise uniquement deploy suivi du SHA Git complet.' >&2
exit 2
