#!/usr/bin/env bash
# A executer sur le VPS dans le checkout, apres l'audit et la preparation HTTPS.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
exec 9>.preprod-deploy.lock
flock -n 9 || { echo 'Un deploiement est deja en cours.' >&2; exit 1; }
test -f .env.preprod.local || { echo '.env.preprod.local absent' >&2; exit 1; }
chmod 600 .env.preprod.local
compose=(docker compose --env-file .env.preprod.local -f compose.preprod.yml)
"${compose[@]}" config --quiet
export MAGRIT_RELEASE="${MAGRIT_RELEASE:-$(git -c safe.directory="$PWD" rev-parse --short=12 HEAD)}"
"${compose[@]}" build api web
"${compose[@]}" up -d --wait postgres s3 mail
"${compose[@]}" run --rm migrate
"${compose[@]}" run --rm migrate node scripts/db/seed-pim.mjs
"${compose[@]}" run --rm bootstrap-logins
"${compose[@]}" run --rm s3-init
"${compose[@]}" up -d --wait api web notifications outbox exports purge
printf 'Release deployee : %s\n' "$MAGRIT_RELEASE"
