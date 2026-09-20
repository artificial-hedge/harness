#!/bin/zsh
set -euo pipefail
cd /Users/vaithianathan/.dsh/mcphub
set -a
source /Users/vaithianathan/.dsh/mcphub/env
set +a
export PATH="/Users/vaithianathan/.local/bin:/opt/homebrew/bin:/Users/vaithianathan/.dsh/mcphub/node_modules/.bin:/usr/bin:/bin"
exec /Users/vaithianathan/.local/bin/node /Users/vaithianathan/.dsh/mcphub/node_modules/@samanhappy/mcphub/bin/cli.js
