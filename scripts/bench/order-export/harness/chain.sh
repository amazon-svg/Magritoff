#!/bin/bash
# Enchaine, SANS chevauchement CPU : attente de la fin de run-repeat,
# reconstruction de l image (proj-cachedtz), campagne cachedtz, sondes C1.
SP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
until grep -q '^DONE' $SP/harness/repeat.log 2>/dev/null; do sleep 5; done
cd $SP && docker build -q -f Dockerfile.bench -t magrit-e1018-bench . >/dev/null 2>&1 || { echo BUILD_FAIL > $SP/harness/cachedtz.log; exit 1; }
bash $SP/harness/run-cachedtz.sh $SP/harness/cachedtz.log
bash $SP/c1/run-c1.sh > $SP/c1/c1.log 2>&1
echo CHAIN_DONE >> $SP/c1/c1.log
