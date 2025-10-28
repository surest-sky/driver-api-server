#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

NODE_BIN_DIR="/root/.nvm/versions/node/v23.11.0/bin"
if [[ ! -x "$NODE_BIN_DIR/node" ]]; then
  echo "Expected Node binary not found at $NODE_BIN_DIR/node" >&2
  exit 1
fi

export NODE_ENV="${NODE_ENV:-production}"
export PATH="$NODE_BIN_DIR:/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin:${PATH:-}"

cd "$PROJECT_ROOT"
exec "$NODE_BIN_DIR/npm" run start
