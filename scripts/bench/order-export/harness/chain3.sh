#!/bin/bash
# Le CPU du superviseur se CUMULE-t-il sur un lot d exports traites dans UNE
# invocation (runOnce) ? Cas decisif : 1 x XLSX 10k (reference) contre
# 5 x XLSX 10k, formateur en cache, mode plateforme.
SP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
H=$SP/harness
until grep -q '^DONE' $H/batch.log 2>/dev/null; do sleep 5; done
: > $H/batch2.log
for c in "xlsx 10000 1" "xlsx 10000 5" "csv 50000 1" "csv 50000 5"; do
  set -- $c
  for i in 1 2; do
    EXTRA="cpuSoft=1000&cpuHard=2000&claims=$3" bash $H/bench.sh proj-cachedtz 3g 256 $1 line $2 2>&1 \
      | grep -E '^CASE|"reason"|"status"|Cancelled' | sed -E 's/"mem_check_captured".*//; s/"reset":\{[^}]*\},//; s/"last":\{"verdict":\{/"verdict":{/; s/"file_name[^,]*,//; s/"storage_path[^,]*,//; s/"sha256[^,]*,//' | cut -c1-330 >> $H/batch2.log
    echo "----- claims=$3" >> $H/batch2.log
  done
done
echo DONE >> $H/batch2.log
