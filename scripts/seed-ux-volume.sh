#!/usr/bin/env bash
set -euo pipefail

MAGRIT_PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$MAGRIT_PROJECT_ROOT"

exec node scripts/db/seed-ux-volume.mjs "$@"
