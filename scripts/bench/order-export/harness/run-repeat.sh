#!/bin/bash
# Points de rupture EN MODE PLATEFORME (256 Mo / CPU 1000-2000 ms, valeurs
# du main.ts de la CLI Supabase), 3 repetitions par palier, conteneur 3 Go.
# proj-nolimit : plafond du code releve pour pouvoir depasser 50 000 (scratchpad seulement).
H="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT=${1:-$H/repeat.log}
: > "$OUT"
run() { EXTRA="cpuSoft=1000&cpuHard=2000" bash $H/bench.sh "$@" 2>&1 | grep -v "supabase tag\|applySupabaseTag" | grep -E '^CASE|^CGROUP|"reason"|"status":"ready"|WorkerRequestCancelled|"ok":true,"rows"' | sed -E 's/"mem_check_captured".*//; s/"storage_path.*//' | cut -c1-300 >> "$OUT"; echo "-----" >> "$OUT"; }
for i in 1 2 3; do
  for c in "csv line 10000" "csv line 15000" "csv line 20000" "csv line 25000" \
           "xlsx line 2000" "xlsx line 3500" "xlsx line 5000" "xlsx line 7500"; do
    set -- $c; run proj-nolimit 3g 256 $1 $2 $3
  done
  for n in 50000 75000; do run proj-noop 3g 256 csv line $n; done
  for n in 50000 100000 200000; do run lib-only 3g 256 xlsx line $n; done
done
echo DONE >> "$OUT"
