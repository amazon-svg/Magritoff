#!/bin/bash
# Variance + CPU du superviseur SANS mise a mort : cpuSoft=100 (le depassement
# du seuil souple ne tue pas, il retire le worker apres la requete et emet
# Shutdown/EarlyDrop avec cpu_time_used), cpuHard=120000.
# Compare au mode plateforme (1000/2000) sur les memes cas.
H="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT=${1:-$H/variance.log}
: > "$OUT"
run() { local extra=$1; shift; EXTRA="$extra" bash $H/bench.sh "$@" 2>&1 | grep -v "supabase tag\|applySupabaseTag" | grep -E '^CASE|^CGROUP|"reason"|"status":"ready"|WorkerRequestCancelled' | sed -E 's/"mem_check_captured".*//; s/"storage_path.*//' | cut -c1-260 >> "$OUT"; echo "-----" >> "$OUT"; }
for i in 1 2 3; do
  for c in "csv line 5000" "csv line 20000" "csv line 50000" "xlsx line 5000" "xlsx line 20000" "xlsx line 50000"; do
    set -- $c
    run "cpuSoft=100&cpuHard=120000" proj-nolimit 3g 1024 $1 $2 $3
  done
  for c in "csv line 50000" "csv line 100000"; do
    set -- $c
    run "cpuSoft=100&cpuHard=120000" proj-noop 3g 1024 $1 $2 $3
  done
done
echo DONE >> "$OUT"
