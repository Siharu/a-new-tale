#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# DRIFTER'S TALE — deploy script
# Usage: bash deploy.sh [path/to/update.zip]
# If no zip is given, just repacks and deploys current state.
# ─────────────────────────────────────────────────────────────
set -e
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
ZIP_FILE="${1:-}"

echo "═══════════════════════════════════════"
echo "  WNCORE · DRIFTER DEPLOY"
echo "═══════════════════════════════════════"

# ── 1. Unpack update zip if provided ────────────────────────
if [ -n "$ZIP_FILE" ]; then
  if [ ! -f "$ZIP_FILE" ]; then
    echo "[ERROR] Zip not found: $ZIP_FILE"; exit 1
  fi
  echo "[1/4] Unpacking $ZIP_FILE → $REPO_ROOT …"
  # Extract into a temp dir, then rsync to preserve git
  TMP_UNPACK="$(mktemp -d)"
  unzip -q "$ZIP_FILE" -d "$TMP_UNPACK"
  # Find the first directory inside the zip (the project root)
  INNER="$(find "$TMP_UNPACK" -mindepth 1 -maxdepth 1 -type d | head -1)"
  if [ -z "$INNER" ]; then INNER="$TMP_UNPACK"; fi
  rsync -a --exclude='.git' --exclude='node_modules' "$INNER/" "$REPO_ROOT/"
  rm -rf "$TMP_UNPACK"
  echo "    ✓ Unpacked and merged"
else
  echo "[1/4] No zip provided — using current repo state"
fi

# ── 2. Patch dist/ three imports ────────────────────────────
echo "[2/4] Patching dist/ bare 'three' imports → CDN …"
THREE_CDN="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"
COUNT=0
while IFS= read -r -d '' f; do
  if grep -q "from 'three'" "$f" 2>/dev/null; then
    sed -i "s|from 'three'|from '$THREE_CDN'|g" "$f"
    COUNT=$((COUNT + 1))
  fi
done < <(find "$REPO_ROOT/dist" -name "*.js" -print0 2>/dev/null)
echo "    ✓ Patched $COUNT file(s)"

# ── 3. Git commit & push ─────────────────────────────────────
echo "[3/4] Committing …"
cd "$REPO_ROOT"
git add -A
TIMESTAMP="$(date '+%Y-%m-%d %H:%M')"
git commit -m "deploy: $TIMESTAMP" --allow-empty
git push
echo "    ✓ Pushed to remote"

# ── 4. Vercel deploy ─────────────────────────────────────────
echo "[4/4] Deploying to Vercel …"
if command -v vercel &>/dev/null; then
  vercel --prod --yes
  echo "    ✓ Vercel deploy triggered"
else
  echo "    ⚠  vercel CLI not found — push alone should trigger auto-deploy"
fi

echo ""
echo "═══════════════════════════════════════"
echo "  SIGNAL RESTORED · DEPLOY COMPLETE"
echo "═══════════════════════════════════════"
