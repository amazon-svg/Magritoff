#!/bin/bash
# Bisection du memoryLimitMb MINIMAL du worker (verdict du SUPERVISEUR),
# conteneur a 3 Go pour que le cgroup n interfere pas.
# Usage : bisect.sh <proj|proj-nolimit> <format> <gran> <rows> <lo_mb_fail_or_0> <hi_mb_pass>
H="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJ=$1; FMT=$2; GRAN=$3; ROWS=$4; LO=$5; HI=$6
pass() {
  local out
  out=$(bash $H/bench.sh $PROJ 3g $1 $FMT $GRAN $ROWS 2>&1)
  echo "$out" | grep -E '^RESP|^CGROUP' | sed "s/^/  [mem=$1] /" | cut -c1-260 >&2
  echo "$out" | grep -q '"status":"ready"'
}
# verifie la borne haute
if ! pass $HI; then echo "BISECT $FMT $GRAN $ROWS : ECHEC meme a ${HI} Mo"; exit 0; fi
while [ $((HI - LO)) -gt 16 ]; do
  MID=$(( (LO + HI) / 2 ))
  if pass $MID; then HI=$MID; else LO=$MID; fi
done
echo "BISECT $FMT $GRAN $ROWS : passe a ${HI} Mo, echoue a ${LO} Mo"
