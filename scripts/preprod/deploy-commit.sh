#!/usr/bin/env bash
# Execute par le compte ubuntu, depuis l'entree SSH limitee de la CI.
set -euo pipefail
revision="${1:-}"
[[ $# == 1 && "$revision" =~ ^[0-9a-f]{40}$ ]] || {
  echo 'Un SHA Git complet est requis.' >&2; exit 2;
}
cd /opt/magritoff-preprod
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo 'Checkout modifie : deploiement interrompu.' >&2; exit 1;
fi
git fetch origin refs/heads/codex/preprod-compose
if [[ "$(git rev-parse FETCH_HEAD)" != "$revision" ]]; then
  echo 'Ce commit ne correspond plus a la tete de la branche de preprod.' >&2
  exit 1
fi
git switch --detach "$revision"
sudo -n env MAGRIT_RELEASE="${revision:0:12}" \
  bash /opt/magritoff-preprod/scripts/preprod/deploy.sh
curl --fail --silent --show-error http://127.0.0.1:18787/api/v1/health
curl --fail --silent --show-error --output /dev/null http://127.0.0.1:18080/
