#!/usr/bin/env bash
# Runs Sandcastle whenever there are open issues labelled "Sandcastle", then
# waits and checks again. Ctrl-C to stop.
#
#   npm run sandcastle:loop
#   SANDCASTLE_POLL_SECONDS=120 npm run sandcastle:loop

set -euo pipefail

REPO="MikaelEdebro/boka"
POLL_SECONDS="${SANDCASTLE_POLL_SECONDS:-300}"

cd "$(dirname "$0")/.."

log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

open_issue_count() {
  gh issue list -R "$REPO" --label Sandcastle --state open --json number --jq 'length'
}

while true; do
  count="$(open_issue_count || echo 0)"
  if [ "$count" -gt 0 ]; then
    log "$count open Sandcastle issue(s), starting run"
    npm run sandcastle || log "run failed (exit $?)"
    log "run finished"
  else
    log "no open Sandcastle issues"
  fi
  sleep "$POLL_SECONDS"
done
