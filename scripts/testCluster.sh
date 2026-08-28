#!/usr/bin/env bash
#
# Run the test suite across two Macs.
#
# WHY THIS EXISTS, AND WHAT IT IS AND ISN'T WORTH
#
# The suite's cost is dominated by full-world multi-season sims. Those were
# split into many files (see test/helpers/shardPartition.ts) so no single file
# is the floor any more, which means the binding constraint is now total work
# divided by how much machine you can point at it.
#
# The catch, measured on an 8GB fanless MacBook: this machine does not scale to
# its own core count. test/core/offseasonFinance.test.ts runs in 156s alone and
# 244s alongside three other heavy files -- 1.57x inflation at four workers on
# eight cores. That is not CPU contention; it is memory bandwidth and thermal
# throttling. Parallel efficiency across those four files was about 55%.
#
# So a second machine buys more than its core count suggests: it brings its own
# memory subsystem and its own thermal budget, which is the part this machine is
# actually short of. That is also why the split is capacity-weighted rather than
# 50/50 -- a 16GB machine is worth more than one share.
#
# USAGE
#   npm run test:cluster            # distribute if the remote is up, else local
#   npm run test:cluster -- --local # force a single-machine run
#   npm run test:cluster -- <args>  # extra args are passed through to vitest
#
# Configure by copying .test-cluster.example.json to .test-cluster.json (which
# is gitignored, since the hostname is yours and not the repo's).

set -uo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
CONFIG="$ROOT/.test-cluster.json"
EXAMPLE="$ROOT/.test-cluster.example.json"

FORCE_LOCAL=0
VITEST_ARGS=()
for arg in "$@"; do
  if [ "$arg" = "--local" ]; then FORCE_LOCAL=1; else VITEST_ARGS+=("$arg"); fi
done

# ---------------------------------------------------------------- config ----

if [ ! -f "$CONFIG" ]; then
  if [ -f "$EXAMPLE" ]; then
    cp "$EXAMPLE" "$CONFIG"
    echo "Created $CONFIG from the example. Set \"remoteHost\" in it to enable"
    echo "the second machine; running locally for now."
  fi
fi

read_cfg() {
  python3 - "$CONFIG" "$1" "$2" <<'PY'
import json, sys
path, key, default = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    with open(path) as fh:
        print(json.load(fh).get(key, default))
except Exception:
    print(default)
PY
}

REMOTE_HOST=$(read_cfg remoteHost "")
REMOTE_DIR=$(read_cfg remoteDir "~/soccer-gm-testcluster")
LOCAL_WORKERS=$(read_cfg localMaxWorkers "")
REMOTE_WORKERS=$(read_cfg remoteMaxWorkers "")
CAP_LOCAL=$(read_cfg capacityLocal "1")
CAP_REMOTE=$(read_cfg capacityRemote "1")
AUTOTUNE=$(read_cfg autotune "true")

run_local_only() {
  echo "==> Running the whole suite on this machine."
  # macOS ships bash 3.2, where "${arr[@]}" on an EMPTY array is an unbound
  # variable error under `set -u`. Hence the ${arr[@]+...} guard on every array
  # expansion in this script.
  local args=()
  [ -n "$LOCAL_WORKERS" ] && args+=("--maxWorkers=$LOCAL_WORKERS")
  exec npx vitest run ${args[@]+"${args[@]}"} ${VITEST_ARGS[@]+"${VITEST_ARGS[@]}"}
}

if [ "$FORCE_LOCAL" = "1" ]; then run_local_only; fi
if [ -z "$REMOTE_HOST" ]; then
  echo "==> No remoteHost configured in .test-cluster.json."
  run_local_only
fi

# ----------------------------------------------------------------- probe ----

# Short timeout and BatchMode so a sleeping or absent laptop costs two seconds
# and never hangs waiting for a password prompt.
echo "==> Probing $REMOTE_HOST ..."
if ! ssh -o ConnectTimeout=2 -o BatchMode=yes "$REMOTE_HOST" true 2>/dev/null; then
  echo "==> $REMOTE_HOST is unreachable (asleep, offline, or no key auth)."
  run_local_only
fi
echo "==> $REMOTE_HOST is up."

# ------------------------------------------------------------------ sync ----

echo "==> Syncing working tree to $REMOTE_HOST:$REMOTE_DIR"
ssh "$REMOTE_HOST" "mkdir -p $REMOTE_DIR" || exit 1

# --delete so a file deleted locally is deleted there too; without it a test
# you just removed keeps running on the remote and keeps reporting green.
rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.vitest-reports' \
  --exclude '.claude/worktrees' \
  --exclude 'leaguesaves' \
  "$ROOT/" "$REMOTE_HOST:$REMOTE_DIR/" || exit 1

# The dangerous failure of a distributed run is a FALSE GREEN: the remote tests
# code that isn't what you have, and reports pass. rsync is usually reliable,
# but an excluded path, an interrupted transfer or a stale checkout all produce
# exactly that. So hash what matters on both sides and refuse to run on a
# mismatch, rather than trusting the copy.
hash_cmd='find src test scripts vite.config.ts package.json tsconfig.json -type f 2>/dev/null | LC_ALL=C sort | xargs shasum | shasum | cut -d" " -f1'
LOCAL_HASH=$(cd "$ROOT" && eval "$hash_cmd")
REMOTE_HASH=$(ssh "$REMOTE_HOST" "cd $REMOTE_DIR && $hash_cmd")

if [ "$LOCAL_HASH" != "$REMOTE_HASH" ]; then
  echo "ERROR: tree hash mismatch after sync."
  echo "  local:  $LOCAL_HASH"
  echo "  remote: $REMOTE_HASH"
  echo "Refusing to run: a green result would not mean your code passes."
  exit 1
fi
echo "==> Trees match ($LOCAL_HASH)."

echo "==> Ensuring remote dependencies"
ssh "$REMOTE_HOST" "cd $REMOTE_DIR && (npm ci --silent 2>&1 | tail -2)" || exit 1

# ------------------------------------------------------------------- run ----

rm -rf "$ROOT/.vitest-reports"
mkdir -p "$ROOT/.vitest-reports"
ssh "$REMOTE_HOST" "rm -rf $REMOTE_DIR/.vitest-reports"

CAPS="$CAP_LOCAL,$CAP_REMOTE"
echo "==> Splitting 1/2 here, 2/2 on $REMOTE_HOST (capacities $CAPS)"

local_args=()
[ -n "$LOCAL_WORKERS" ] && local_args+=("--maxWorkers=$LOCAL_WORKERS")
remote_flag=""
[ -n "$REMOTE_WORKERS" ] && remote_flag="--maxWorkers=$REMOTE_WORKERS"

START=$(date +%s)

( VITEST_SHARD_CAPACITIES="$CAPS" npx vitest run --shard=1/2 --reporter=blob \
    ${local_args[@]+"${local_args[@]}"} ${VITEST_ARGS[@]+"${VITEST_ARGS[@]}"} > "$ROOT/.vitest-reports/local.log" 2>&1
  echo $? > "$ROOT/.vitest-reports/local.exit"
  date +%s > "$ROOT/.vitest-reports/local.done" ) &
LOCAL_PID=$!

( ssh "$REMOTE_HOST" "cd $REMOTE_DIR && VITEST_SHARD_CAPACITIES='$CAPS' npx vitest run --shard=2/2 --reporter=blob $remote_flag ${VITEST_ARGS[*]+${VITEST_ARGS[*]}}" \
    > "$ROOT/.vitest-reports/remote.log" 2>&1
  echo $? > "$ROOT/.vitest-reports/remote.exit"
  date +%s > "$ROOT/.vitest-reports/remote.done" ) &
REMOTE_PID=$!

wait $LOCAL_PID
wait $REMOTE_PID

LOCAL_RC=$(cat "$ROOT/.vitest-reports/local.exit" 2>/dev/null || echo 1)
REMOTE_RC=$(cat "$ROOT/.vitest-reports/remote.exit" 2>/dev/null || echo 1)
LOCAL_SECS=$(( $(cat "$ROOT/.vitest-reports/local.done" 2>/dev/null || date +%s) - START ))
REMOTE_SECS=$(( $(cat "$ROOT/.vitest-reports/remote.done" 2>/dev/null || date +%s) - START ))
TOTAL_SECS=$(( $(date +%s) - START ))

# --------------------------------------------------------------- results ----

scp -q "$REMOTE_HOST:$REMOTE_DIR/.vitest-reports/blob-2-2.json" \
  "$ROOT/.vitest-reports/" 2>/dev/null || {
    echo "WARNING: could not fetch the remote blob report; showing raw logs."
    cat "$ROOT/.vitest-reports/remote.log"
  }

echo
echo "======================================================================"
echo " this machine : ${LOCAL_SECS}s (exit $LOCAL_RC)"
echo " $REMOTE_HOST : ${REMOTE_SECS}s (exit $REMOTE_RC)"
echo " wall clock   : ${TOTAL_SECS}s"
echo "======================================================================"
echo

npx vitest --merge-reports 2>/dev/null || {
  echo "(merge failed; per-machine logs below)"
  tail -30 "$ROOT/.vitest-reports/local.log"
  tail -30 "$ROOT/.vitest-reports/remote.log"
}

# Rebalance for next time. Throughput is work-done over time-taken, and each
# machine was given work in proportion to its capacity, so the corrected
# capacity is proportional to capacity/elapsed. Normalised to keep the smaller
# side at 1. Only meaningful when both sides actually ran, so a failed or
# skipped run leaves the numbers alone.
if [ "$AUTOTUNE" = "True" ] || [ "$AUTOTUNE" = "true" ]; then
  if [ "$LOCAL_SECS" -gt 10 ] && [ "$REMOTE_SECS" -gt 10 ]; then
    python3 - "$CONFIG" "$CAP_LOCAL" "$CAP_REMOTE" "$LOCAL_SECS" "$REMOTE_SECS" <<'PY'
import json, sys
path, cl, cr, tl, tr = sys.argv[1], *map(float, sys.argv[2:6])
nl, nr = cl / tl, cr / tr
lo = min(nl, nr)
nl, nr = round(nl / lo, 2), round(nr / lo, 2)
try:
    with open(path) as fh: cfg = json.load(fh)
except Exception:
    cfg = {}
if abs(nl - cl) > 0.05 or abs(nr - cr) > 0.05:
    cfg["capacityLocal"], cfg["capacityRemote"] = nl, nr
    with open(path, "w") as fh: json.dump(cfg, fh, indent=2); fh.write("\n")
    print(f"==> Rebalanced for next run: local {cl}->{nl}, remote {cr}->{nr}")
else:
    print("==> Split was balanced; capacities unchanged.")
PY
  fi
fi

[ "$LOCAL_RC" = "0" ] && [ "$REMOTE_RC" = "0" ] && exit 0
exit 1
