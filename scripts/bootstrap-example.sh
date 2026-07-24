#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLE="$ROOT/example"

if [ -d "$EXAMPLE/android" ] && [ -d "$EXAMPLE/ios" ]; then
  echo "Example native projects already exist."
  exit 0
fi

echo "Scaffolding React Native example app..."
TMP="$ROOT/.tmp-example-scaffold"
rm -rf "$TMP"
npx @react-native-community/cli@latest init RingtoneKitExample \
  --version 0.76.5 \
  --skip-install \
  --directory "$TMP"

mkdir -p "$EXAMPLE"
cp -R "$TMP/android" "$EXAMPLE/android"
cp -R "$TMP/ios" "$EXAMPLE/ios"
cp "$TMP/Gemfile" "$EXAMPLE/Gemfile" 2>/dev/null || true
rm -rf "$TMP"

echo "Example native scaffold complete."
