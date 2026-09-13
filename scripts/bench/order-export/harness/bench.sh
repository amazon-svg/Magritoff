#!/bin/bash
# Banc E10.18 — chemin reel du runner dans supabase/edge-runtime:v1.69.12
# (image derivee magrit-e1018-bench = v1.69.12 + COPY du banc et de
# l instantane ; /private/tmp n est pas partage par Docker Desktop).
# Usage : bench.sh <proj|proj-nolimit> <container_mem> <worker_mem_mb> <format> <gran> <rows>
# Mesures : verdict du runner + verdict du superviseur (memoryLimitMb du
# worker) + cgroup v2 du conteneur (memory.peak, memory.current, cpu.stat).
set -uo pipefail
PROJ=${1}; CMEM=${2}; WMEM=${3}; FMT=${4}; GRAN=${5}; ROWS=${6}
NAME=magrit-e1018-bench
docker rm -f $NAME >/dev/null 2>&1
docker run -d --name $NAME --memory="$CMEM" --memory-swap="$CMEM" -p 19100:9000 \
  -e DENO_DIR=/deno-dir -v magrit-e1018-denodir:/deno-dir \
  --add-host=host.docker.internal:host-gateway \
  magrit-e1018-bench \
  start --main-service /harness/main --event-worker /harness/events --port 9000 >/dev/null
Q="proj=$PROJ&format=$FMT&gran=$GRAN&mem=$WMEM${EXTRA:+&$EXTRA}"
ok=0
for i in $(seq 1 60); do
  sleep 1
  w=$(curl -s -m 90 "http://localhost:19100/?rows=10&$Q" 2>/dev/null)
  if echo "$w" | grep -q '"status":200'; then ok=1; break; fi
done
if [ $ok -eq 0 ]; then echo "WARMUP_FAIL $w"; docker logs $NAME 2>&1 | tail -20; docker rm -f $NAME >/dev/null 2>&1; exit 1; fi
sleep 1
cg() { docker exec $NAME sh -c "cat /sys/fs/cgroup/$1 2>/dev/null" ; }
BASE_CUR=$(cg memory.current); BASE_PEAK=$(cg memory.peak)
CPU0=$(cg cpu.stat | awk '/usage_usec/{print $2}')
MARK=$(docker logs $NAME 2>&1 | wc -l)
r=$(curl -s -m 400 "http://localhost:19100/?rows=$ROWS&$Q" -w ' HTTP:%{http_code}')
sleep 1
st=$(docker inspect $NAME --format 'running={{.State.Running}} OOMKilled={{.State.OOMKilled}} exit={{.State.ExitCode}}')
PEAK=$(cg memory.peak); CUR=$(cg memory.current)
CPU1=$(cg cpu.stat | awk '/usage_usec/{print $2}')
mb() { local v="${1:-}"; [ -n "$v" ] && echo $(( v / 1048576 )) || echo "?"; }
CPUMS="?"; [ -n "$CPU0" ] && [ -n "$CPU1" ] && CPUMS=$(( (CPU1 - CPU0) / 1000 ))
echo "CASE proj=$PROJ cmem=$CMEM wmem=$WMEM fmt=$FMT gran=$GRAN rows=$ROWS extra=${EXTRA:-}"
echo "RESP $r" | cut -c1-700
echo "CONTAINER $st"
echo "CGROUP base_current=$(mb $BASE_CUR)MiB base_peak=$(mb $BASE_PEAK)MiB peak=$(mb $PEAK)MiB after_current=$(mb $CUR)MiB cpu_delta=${CPUMS}ms"
docker logs $NAME 2>&1 | tail -n +$((MARK+1)) | grep -v "supabase tag\|applySupabaseTag" | grep -E 'EVT|rror|emory|imit|ancel' | grep -v '"Boot"' | cut -c1-600
docker rm -f $NAME >/dev/null 2>&1
