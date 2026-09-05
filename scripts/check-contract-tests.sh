#!/usr/bin/env bash
# Sprint 5 Gestion commerciale — hook Stop : bloque tant que les tests de contrat API echouent.
# Tant que le harnais de contrat (Lot 0, E10.0) n'existe pas encore, ce script ne fait rien.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d "tests/contract" ]; then
  exit 0
fi

pnpm vitest run tests/contract
