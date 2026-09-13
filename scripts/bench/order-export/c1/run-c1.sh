#!/bin/bash
# Sondes C1 : quelle version de fflate edge-runtime v1.69.12 resout-il
# pour write-excel-file@4.1.1 (^0.8.2), avec (a) une entree d import map
# explicite fflate@0.8.2, (b) un deno.lock v4 epinglant 0.8.2 ?
# DENO_DIR NEUF (volume dedie) a chaque sonde : on lit ce qui a ete telecharge.
C1="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd $C1 && docker build -q -f Dockerfile.c1 -t magrit-e1018-c1 . >/dev/null 2>&1 || { echo BUILD_FAIL; exit 1; }
for probe in c1c c1d; do
  docker rm -f mc1 >/dev/null 2>&1; docker volume rm -f mc1-deno >/dev/null 2>&1
  docker run -d --name mc1 -p 19200:9000 -e DENO_DIR=/deno-dir -v mc1-deno:/deno-dir magrit-e1018-c1 \
    start --main-service /$probe --port 9000 >/dev/null
  r=""; for i in $(seq 1 60); do sleep 1; r=$(curl -s -m 60 http://localhost:19200/ 2>/dev/null); [ -n "$r" ] && break; done
  echo "PROBE $probe -> $r"
  docker exec mc1 sh -c 'ls /deno-dir/npm/registry.npmjs.org/fflate 2>/dev/null; ls /deno-dir/npm/registry.npmjs.org/ 2>/dev/null' | tr '\n' ' '; echo
  docker logs mc1 2>&1 | grep -iv "supabase tag\|applySupabaseTag" | grep -i "lock\|integrity\|error\|fflate" | head -5
  docker rm -f mc1 >/dev/null 2>&1
done
docker volume rm -f mc1-deno >/dev/null 2>&1
