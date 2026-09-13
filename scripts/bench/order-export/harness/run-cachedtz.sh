#!/bin/bash
# Effet d un Intl.DateTimeFormat MIS EN CACHE (proj-cachedtz) contre le code
# actuel (proj-nolimit), MODE PLATEFORME, 3 repetitions, memes paliers.
H="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT=${1:-$H/cachedtz.log}
: > "$OUT"
run() { EXTRA="cpuSoft=1000&cpuHard=2000" bash $H/bench.sh "$@" 2>&1 | grep -v "supabase tag\|applySupabaseTag" | grep -E '^CASE|"reason"|"status":"ready"|WorkerRequestCancelled' | sed -E 's/"mem_check_captured".*//; s/"storage_path.*//; s/"reset":\{[^}]*\},//' | cut -c1-260 >> "$OUT"; echo "-----" >> "$OUT"; }
for i in 1 2 3; do
  for c in "csv line 25000" "csv line 50000" "xlsx line 5000" "xlsx line 10000" "xlsx line 20000"; do
    set -- $c; run proj-cachedtz 3g 256 $1 $2 $3
  done
done
echo DONE >> "$OUT"
