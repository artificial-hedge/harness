#!/bin/zsh
set -euo pipefail
# One-shot helper: create (or reuse) a named Cloudflare tunnel for the harness.
# Requires an interactive Cloudflare login the first time.

TUNNEL_NAME="artificial-hedge-harness"
HOSTNAME="harness.artificialhedge.co"
CONFIG="$HOME/.dsh/deploy/cloudflared.yml"
CF_HOME="$HOME/.cloudflared"
export TUNNEL_NAME

if ! command -v cloudflared >/dev/null; then
  echo "cloudflared is not installed" >&2
  exit 1
fi

if [[ ! -f "$CF_HOME/cert.pem" ]]; then
  echo "Opening Cloudflare login in the browser. Approve the domain, then re-run this script."
  cloudflared tunnel login
fi

if ! cloudflared tunnel list 2>/dev/null | grep -q "$TUNNEL_NAME"; then
  cloudflared tunnel create "$TUNNEL_NAME"
fi

ID="$(cloudflared tunnel list -o json | python3.11 -c 'import json,sys,os; name=os.environ["TUNNEL_NAME"]; data=json.load(sys.stdin); print(next(t["id"] for t in data if t.get("name")==name))')"
CRED="$CF_HOME/${ID}.json"
export CONFIG ID CRED
python3.11 - <<'PY'
import os
import re
from pathlib import Path

path = Path(os.environ["CONFIG"])
text = path.read_text()
text = re.sub(r"(?m)^tunnel: .*?$", f"tunnel: {os.environ['ID']}", text)
text = re.sub(
    r"(?m)^credentials-file: .*?$",
    f"credentials-file: {os.environ['CRED']}",
    text,
)
temporary = path.with_suffix(path.suffix + ".tmp")
temporary.write_text(text)
temporary.replace(path)
print("wrote", path)
print("credentials configured")
print(f"CNAME harness -> {os.environ['ID']}.cfargotunnel.com")
PY

cloudflared tunnel route dns "$TUNNEL_NAME" "$HOSTNAME"
echo "Start with: cloudflared tunnel --config $CONFIG run $TUNNEL_NAME"
