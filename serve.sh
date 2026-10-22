#!/usr/bin/env bash
# Serve the TorqueLine site on http://localhost:8080
# Matches the port expected by .vscode/launch.json so F5 works in VS Code.
set -e
cd "$(dirname "$0")"

PORT="${PORT:-8080}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to run the local server."
  exit 1
fi

echo "TorqueLine running at http://localhost:${PORT}"
echo "Press Ctrl+C to stop."
exec python3 -m http.server "$PORT" --bind 127.0.0.1
