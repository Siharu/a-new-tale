#!/usr/bin/env sh
set -e

if [ ! -x "$(command -v npm)" ]; then
  echo "Error: npm is not installed or not in PATH."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Building TypeScript project into dist/..."
npm run build

echo "Build complete. Check dist/ for output."
