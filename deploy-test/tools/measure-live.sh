#!/usr/bin/env bash
# Measures a deployed test Worker: real CPU from wrangler tail, plus timings and errors.
# Sends about 1,300 requests, well inside the free 100,000 a day.
# Usage: bash tools/measure-live.sh <worker-name> <https-url> <output-dir>
set -uo pipefail

worker="$1"; base="${2%/}"; out="$3"
tools="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$out"

cd "$tools/../opennext"
npx wrangler tail "$worker" --format json > "$out/tail.log" 2> "$out/tail.err" &
tail_pid=$!
sleep 12 # Tail takes a few seconds to attach.

curl -s -o /dev/null -w "first request after deploy: %{http_code} %{time_total}s\n" "$base/api/health"

# 100 requests per path, one at a time, recording time to first byte and failures.
for path in /api/health / /c/earrings /p/sample-1 /p/sample-40 /ssr /login /account /no-such; do
  : > "$out/ttfb.tmp"
  fails=0
  for _ in $(seq 1 100); do
    line=$(curl -s -o /dev/null -w "%{http_code} %{time_starttransfer}" "$base$path")
    code=${line%% *}
    case "$path:$code" in
      /no-such:404|/account:307|*:200) ;;
      *) fails=$((fails + 1)) ;;
    esac
    echo "${line##* }" >> "$out/ttfb.tmp"
  done
  sort -n "$out/ttfb.tmp" | awk -v p="$path" -v f="$fails" '{a[NR]=$1} END {printf "%-16s ttfb p50 %4.0f ms  p95 %4.0f ms  failures %d\n", p, a[int(NR*0.5)]*1000, a[int(NR*0.95)]*1000, f}'
done | tee "$out/timing.txt"

# A short burst of 40 parallel requests per path.
for path in / /ssr; do
  seq 1 40 | xargs -P 10 -I{} curl -s -o /dev/null -w "%{http_code}\n" "$base$path" | sort | uniq -c | tr '\n' ' ' | sed "s#^#burst $path: #"
  echo
done | tee "$out/burst.txt"

sleep 15 # Let the last events arrive.
kill "$tail_pid" 2>/dev/null
wait "$tail_pid" 2>/dev/null

rm -f "$out/ttfb.tmp"
node "$tools/cpu-report.mjs" "$out/tail.log" | tee "$out/cpu.txt"
