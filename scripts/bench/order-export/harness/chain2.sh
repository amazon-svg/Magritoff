#!/bin/bash
# 1) sondes C1c/C1d ; 2) redemarrage du faux serveur (claims=N) ; 3) image ;
# 4) LOT de plusieurs exports dans UNE invocation (CPU cumule ?), mode plateforme.
SP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
H=$SP/harness
bash $SP/c1/run-c1.sh > $SP/c1/c1-cd.log 2>&1
pkill -f fake-supabase.ts; sleep 1
(cd $H && nohup deno run --allow-net fake-supabase.ts > $H/fake2.log 2>&1 &)
until curl -s -m 2 "http://localhost:54410/last" >/dev/null 2>&1; do sleep 1; done
cd $SP && docker build -q -f Dockerfile.bench -t magrit-e1018-bench . >/dev/null 2>&1 || { echo BUILD_FAIL > $H/batch.log; exit 1; }
: > $H/batch.log
for c in "csv 10000 5" "xlsx 5000 1" "xlsx 5000 3" "xlsx 2000 5"; do
  set -- $c
  for i in 1 2; do
    EXTRA="cpuSoft=1000&cpuHard=2000&claims=$3" bash $H/bench.sh proj-cachedtz 3g 256 $1 line $2 2>&1 \
      | grep -E '^CASE|"reason"|"status"|Cancelled' | sed -E 's/"mem_check_captured".*//; s/"reset":\{[^}]*\},//; s/"storage_path[^,]*,//; s/"sha256[^,]*,//' | cut -c1-420 >> $H/batch.log
    echo "----- claims=$3" >> $H/batch.log
  done
done
echo DONE >> $H/batch.log
