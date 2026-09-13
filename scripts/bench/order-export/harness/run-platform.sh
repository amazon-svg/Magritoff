#!/bin/bash
# Mode PLATEFORME : worker memoryLimitMb=256, cpuTimeSoftLimitMs=1000,
# cpuTimeHardLimitMs=2000 (valeurs EXACTES du main.ts de la CLI Supabase),
# conteneur 3 Go (le cgroup n est pas le budget de la fonction).
H="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT=${1:-$H/platform.log}
: > "$OUT"
run() { EXTRA="cpuSoft=1000&cpuHard=2000" bash $H/bench.sh "$@" 2>&1 | grep -v "supabase tag\|applySupabaseTag" >> "$OUT"; echo "-----" >> "$OUT"; }
for FMT in csv xlsx; do
  for ROWS in 5000 10000 20000 30000 50000; do
    run proj 3g 256 $FMT line $ROWS
  done
done
# Imputation : lecture paginee + accumulation SEULES (renderer factice)
for ROWS in 20000 50000 100000; do
  run proj-noop 3g 256 csv line $ROWS
done
# Granularite order (plus etroite) aux paliers utiles
for FMT in csv xlsx; do
  for ROWS in 20000 50000; do
    run proj 3g 256 $FMT order $ROWS
  done
done
echo DONE >> "$OUT"
