#!/usr/bin/env bash
# Run this from your repo root: bash fix-deploy.sh drifter-deploy.zip
set -e
REPO="$(pwd)"
ZIP="${1:-drifter-deploy.zip}"

echo "[1] Checking zip..."
if [ ! -f "$ZIP" ]; then echo "ERROR: $ZIP not found in $(pwd)"; exit 1; fi

# Show what's inside the zip
echo "[2] Zip contents (top level):"
unzip -l "$ZIP" | head -20

# Unpack to tmp
TMP=$(mktemp -d)
unzip -q "$ZIP" -d "$TMP"
echo "[3] Unpacked to $TMP"

# Find the inner project folder
INNER=$(find "$TMP" -maxdepth 2 -name "menu.html" | head -1 | xargs dirname)
echo "[4] Found project at: $INNER"
echo "    menu.html preview (first 5 lines):"
head -5 "$INNER/menu.html"

# Copy files into repo root
echo "[5] Copying into $REPO ..."
rsync -a --exclude='.git' --exclude='node_modules' "$INNER/" "$REPO/"
echo "    menu.html now in repo:"
head -5 "$REPO/menu.html"

# Remove LFS hooks
HOOKS="$(git rev-parse --git-dir)/hooks"
rm -f "$HOOKS/post-commit" "$HOOKS/pre-push" "$HOOKS/post-checkout" "$HOOKS/post-merge"
echo "[6] LFS hooks removed"

# Patch dist three imports
echo "[7] Patching three imports..."
THREE_CDN="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"
COUNT=0
while IFS= read -r -d '' f; do
  if grep -q "from 'three'" "$f" 2>/dev/null; then
    sed -i "s|from 'three'|from '$THREE_CDN'|g" "$f"
    COUNT=$((COUNT+1))
  fi
done < <(find "$REPO/dist" -name "*.js" -print0 2>/dev/null)
echo "    Patched $COUNT files"

# Commit and push
echo "[8] Committing..."
git add -A
git commit -m "deploy: fix menu + three imports $(date '+%Y-%m-%d %H:%M')" --allow-empty
git pull --rebase origin main
git push origin main
echo "[9] Pushed. Check Vercel for redeploy."
rm -rf "$TMP"
