#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-dev}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$SERVER_DIR"

if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  source "$HOME/.nvm/nvm.sh"
else
  echo "Error: NVM is not available. Install nvm, then run 'nvm install 22' for backend development." >&2
  exit 1
fi

if ! nvm use 22 >/dev/null; then
  echo "Error: Node 22 is not installed. Run: nvm install 22" >&2
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" != "22" ]]; then
  echo "Error: backend requires Node 22, but active version is Node ${NODE_MAJOR}." >&2
  exit 1
fi

if [[ -d node_modules/better-sqlite3 ]]; then
  if ! node -e "require('better-sqlite3')" >/dev/null 2>&1; then
    echo "Rebuilding better-sqlite3 for Node 22..."
    npm rebuild better-sqlite3
  fi
fi

case "$MODE" in
  dev)
    exec npx tsx watch src/index.ts
    ;;
  start)
    exec npx tsx src/index.ts
    ;;
  *)
    echo "Error: unknown mode '$MODE'. Expected 'dev' or 'start'." >&2
    exit 1
    ;;
esac
