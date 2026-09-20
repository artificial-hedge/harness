#!/bin/bash
set -u
ROOT="$HOME/.dsh/ssh-workspaces/me@100.116.120.51/D_dipcatcher"
PULL="$HOME/.dsh/bin/dsh-dipcatcher-pull.py"
PUSH="$HOME/.dsh/bin/dsh-dipcatcher-push.py"
LOG="$HOME/.dsh/dipcatcher-sync.log"
mkdir -p "$ROOT"
if [[ ! -d "$ROOT/src" ]]; then
  echo "$(date -u +%FT%TZ) initial pull" >>"$LOG"
  python3 "$PULL" >>"$LOG" 2>&1 || true
fi
while true; do
  if [[ -d "$ROOT/src" ]]; then
    python3 "$PUSH" >>"$LOG" 2>&1 || echo "$(date -u +%FT%TZ) push failed" >>"$LOG"
  fi
  sleep 15
done
