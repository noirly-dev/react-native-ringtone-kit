#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLE="$ROOT/example"

if [ ! -d "$EXAMPLE/android" ] || [ ! -d "$EXAMPLE/ios" ]; then
  echo "Example native projects missing. Run: yarn bootstrap:example"
  exit 1
fi

cd "$EXAMPLE"
npx react-native codegen

echo "Codegen verification passed."
