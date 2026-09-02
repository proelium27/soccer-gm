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

# The config is GITIGNORED (it names your machine), and a git worktree only
# checks out TRACKED files — so it is never present in one, and looking for it
# beside the worktree's package.json is a guaranteed false negative. That reads
# as "no second machine configured" and silently falls back to a local run,
# which is how a worktree session ends up running the suite at 1x while the
# other Mac sits idle. Resolve it from the MAIN checkout when it is not here:
# `git rev-parse --git-common-dir` points at the main .git from any worktree.
if [ ! -f "$CONFIG" ]; then
  COMMON_DIR=$(git -C "$ROOT" rev-parse --git-common-dir 2>/dev/null || true)
  case "$COMMON_DIR" in
    "") ;;
    /*) MAIN_ROOT=$(dirname "$COMMON_DIR") ;;
    *)  MAIN_ROOT=$(cd "$ROOT/$(dirname "$COMMON_DIR")" 2>/dev/null && pwd || true) ;;
  esac
  if [ -n "${MAIN_ROOT:-}" ] && [ -f "$MAIN_ROOT/.test-cluster.json" ]; then
    CONFIG="$MAIN_ROOT/.test-cluster.json"
    echo "==> Using the main checkout's cluster config: $CONFIG"
  fi
fi

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
  # --minWorkers too: vitest's default minWorkers sits at the core count, so
  # capping only maxWorkers below it is a contradiction and vitest aborts the
  # whole run with "options.minThreads and options.maxThreads must not conflict"
  # -- zero tests, exit 1.
  [ -n "$LOCAL_WORKERS" ] && args+=("--minWorkers=1" "--maxWorkers=$LOCAL_WORKERS")
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

# Run a remote command in a LOGIN shell.
#
# `ssh host cmd` gets a non-login, non-interactive shell, which on macOS never
# sources /etc/zprofile and so never runs path_helper. The result is a bare
# PATH of /usr/bin:/bin:/usr/sbin:/sbin -- without /usr/local/bin, where the
# Node installer puts node. So `npm ci` fails with "command not found" on a
# machine where node works perfectly when you sit at it. Measured on this very
# setup, which is how it was found.
#
# A login shell restores the real PATH, and doing it here means neither machine
# needs its dotfiles edited for this script to work. The command arrives on
# stdin so nesting quotes stays sane, and the remote exit code propagates.
rsh() { ssh "$REMOTE_HOST" 'zsh -ls' <<< "$1"; }

# ------------------------------------------------------------------ sync ----

echo "==> Syncing working tree to $REMOTE_HOST:$REMOTE_DIR"
rsh "mkdir -p $REMOTE_DIR" || exit 1

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
REMOTE_HASH=$(rsh "cd $REMOTE_DIR && $hash_cmd")

if [ "$LOCAL_HASH" != "$REMOTE_HASH" ]; then
  echo "ERROR: tree hash mismatch after sync."
  echo "  local:  $LOCAL_HASH"
  echo "  remote: $REMOTE_HASH"
  echo "Refusing to run: a green result would not mean your code passes."
  exit 1
fi
echo "==> Trees match ($LOCAL_HASH)."

echo "==> Ensuring remote dependencies"
rsh "cd $REMOTE_DIR && npm ci --silent 2>&1 | tail -2" || exit 1

# ------------------------------------------------------------------- run ----

# `vitest run --merge-reports` reads EVERY file in .vitest-reports as a blob and
# dies on anything that isn't one ("$parse(...).map is not a function"). So the
# per-machine logs and exit codes go in their own directory; .vitest-reports
# holds blobs and nothing else.
RUNDIR="$ROOT/.test-cluster-run"
rm -rf "$ROOT/.vitest-reports" "$RUNDIR"
mkdir -p "$ROOT/.vitest-reports" "$RUNDIR"
rsh "rm -rf $REMOTE_DIR/.vitest-reports"

CAPS="$CAP_LOCAL,$CAP_REMOTE"
echo "==> Splitting 1/2 here, 2/2 on $REMOTE_HOST (capacities $CAPS)"

# See run_local_only for why --minWorkers has to move with --maxWorkers.
local_args=()
[ -n "$LOCAL_WORKERS" ] && local_args+=("--minWorkers=1" "--maxWorkers=$LOCAL_WORKERS")
remote_flag=""
[ -n "$REMOTE_WORKERS" ] && remote_flag="--minWorkers=1 --maxWorkers=$REMOTE_WORKERS"

START=$(date +%s)

( VITEST_SHARD_CAPACITIES="$CAPS" npx vitest run --shard=1/2 --reporter=blob \
    ${local_args[@]+"${local_args[@]}"} ${VITEST_ARGS[@]+"${VITEST_ARGS[@]}"} > "$RUNDIR/local.log" 2>&1
  echo $? > "$RUNDIR/local.exit"
  date +%s > "$RUNDIR/local.done" ) &
LOCAL_PID=$!

( rsh "cd $REMOTE_DIR && VITEST_SHARD_CAPACITIES='$CAPS' npx vitest run --shard=2/2 --reporter=blob $remote_flag ${VITEST_ARGS[*]+${VITEST_ARGS[*]}}" \
    > "$RUNDIR/remote.log" 2>&1
  echo $? > "$RUNDIR/remote.exit"
  date +%s > "$RUNDIR/remote.done" ) &
REMOTE_PID=$!

wait $LOCAL_PID
wait $REMOTE_PID

LOCAL_RC=$(cat "$RUNDIR/local.exit" 2>/dev/null || echo 1)
REMOTE_RC=$(cat "$RUNDIR/remote.exit" 2>/dev/null || echo 1)
LOCAL_SECS=$(( $(cat "$RUNDIR/local.done" 2>/dev/null || date +%s) - START ))
REMOTE_SECS=$(( $(cat "$RUNDIR/remote.done" 2>/dev/null || date +%s) - START ))
TOTAL_SECS=$(( $(date +%s) - START ))

# --------------------------------------------------------------- results ----

scp -q "$REMOTE_HOST:$REMOTE_DIR/.vitest-reports/blob-2-2.json" \
  "$ROOT/.vitest-reports/" 2>/dev/null || {
    echo "WARNING: could not fetch the remote blob report; showing raw logs."
    cat "$RUNDIR/remote.log"
  }

echo
echo "======================================================================"
echo " this machine : ${LOCAL_SECS}s (exit $LOCAL_RC)"
echo " $REMOTE_HOST : ${REMOTE_SECS}s (exit $REMOTE_RC)"
echo " wall clock   : ${TOTAL_SECS}s"
echo "======================================================================"
echo

# `run` is required: without it vitest defaults to watch mode, and merging is
# rejected outright ("Cannot merge reports with --watch enabled").
npx vitest run --merge-reports 2>/dev/null || {
  echo "(merge failed; per-machine logs below)"
  tail -30 "$RUNDIR/local.log"
  tail -30 "$RUNDIR/remote.log"
}

# Rebalance for next time. Throughput is work over time, and each machine got
# work in proportion to its capacity, so the corrected capacity goes as
# capacity/elapsed.
#
# Three things keep that from chasing noise, all of which it did before they
# were added -- a filtered `test/ui` run moved the remote from 2.0 to 8.86,
# which is not a real 8.9x machine:
#
#  1. Only on a FULL run. A filtered run measures a handful of files whose
#     weights barely matter, so its ratio says nothing about the whole suite.
#  2. Only when both sides ran long enough that fixed overhead (rsync, npm ci,
#     vitest startup) isn't most of the elapsed time.
#  3. Damped, and clamped to at most 4:1. Bins hold whole files, so the split is
#     never exactly proportional and a single run always over- or undershoots.
#     Moving halfway converges over a few runs without oscillating.
if [ "$AUTOTUNE" = "True" ] || [ "$AUTOTUNE" = "true" ]; then
  if [ ${#VITEST_ARGS[@]} -ne 0 ]; then
    echo "==> Filtered run; leaving capacities alone (they describe a full suite)."
  elif [ "$LOCAL_SECS" -lt 120 ] || [ "$REMOTE_SECS" -lt 120 ]; then
    echo "==> Run too short to retune capacities reliably; left unchanged."
  else
    python3 - "$CONFIG" "$CAP_LOCAL" "$CAP_REMOTE" "$LOCAL_SECS" "$REMOTE_SECS" <<'PY'
import json, sys

DAMP, MAX_RATIO = 0.5, 4.0
path = sys.argv[1]
cl, cr, tl, tr = map(float, sys.argv[2:6])

est = [cl / tl, cr / tr]
lo = min(est)
est = [e / lo for e in est]                       # normalise: smaller side = 1
new = [c + (e - c) * DAMP for c, e in zip((cl, cr), est)]
lo = min(new)
new = [round(min(n / lo, MAX_RATIO), 2) for n in new]
nl, nr = new

try:
    with open(path) as fh:
        cfg = json.load(fh)
except Exception:
    cfg = {}

if abs(nl - cl) > 0.05 or abs(nr - cr) > 0.05:
    cfg["capacityLocal"], cfg["capacityRemote"] = nl, nr
    with open(path, "w") as fh:
        json.dump(cfg, fh, indent=2)
        fh.write("\n")
    print(f"==> Rebalanced for next run: local {cl}->{nl}, remote {cr}->{nr}")
else:
    print("==> Split was balanced; capacities unchanged.")
PY
  fi
fi

[ "$LOCAL_RC" = "0" ] && [ "$REMOTE_RC" = "0" ] && exit 0
exit 1
