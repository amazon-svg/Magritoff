#!/bin/bash
# Matrice E10.18 : chemin reel, worker 256 Mo (superviseur), conteneur 256 Mo
# puis conteneur 2 Go (pour separer le verdict du superviseur de celui du cgroup).
H="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT=${1:-$H/matrix.log}
: > "$OUT"
for CMEM in 256m 2g; do
  for FMT in csv xlsx; do
    for ROWS in 5000 20000 50000; do
      bash $H/bench.sh proj $CMEM 256 $FMT line $ROWS 2>&1 | grep -v "supabase tag\|applySupabaseTag" >> "$OUT"
      echo "-----" >> "$OUT"
    done
  done
done
echo DONE >> "$OUT"
