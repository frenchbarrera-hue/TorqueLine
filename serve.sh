#!/usr/bin/env bash
# Serve TorqueLine (static files + messaging API) on http://localhost:8080
# Matches the port expected by .vscode/launch.json so F5 works in VS Code.
set -e
cd "$(dirname "$0")"

export PORT="${PORT:-8080}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to run the local server."
  exit 1
fi

exec python3 server.py
