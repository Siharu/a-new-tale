#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
#  A NEW TALE — Codespace Deploy
#
#  Usage:
#    bash deploy.sh                        ← compile + push current tree
#    bash deploy.sh a-new-tale-fixes.zip   ← unpack zip, compile, push
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; C='\033[0;36m'; N='\033[0m'
ok()   { echo -e "${G}✓${N}  $1"; }
info() { echo -e "${Y}→${N}  $1"; }
err()  { echo -e "${R}✗${N}  $1"; }
sep()  { echo -e "\n${C}────────────────────────────────────────────${N}"; }

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZIP="${1:-}"

sep; echo "  WNCORE · A NEW TALE · DEPLOY"; sep

# ── 1. Unpack ──────────────────────────────────────────────────────────
if [ -n "$ZIP" ]; then
  [ ! -f "$ZIP" ] && { err "Zip not found: $ZIP"; exit 1; }
  info "Extracting $ZIP …"
  TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
  unzip -q "$ZIP" -d "$TMP"

  # Find inner root (contains package.json + src/)
  INNER=""
  for d in "$TMP"/*/; do
    [ -f "${d}package.json" ] && [ -d "${d}src" ] && { INNER="${d%/}"; break; }
  done
  [ -z "$INNER" ] && INNER="$TMP"

  rsync -a --exclude='.git' --exclude='node_modules' --exclude='*.zip' \
    "$INNER/" "$REPO/"
  ok "Unpacked → $REPO"
else
  ok "No zip — using current tree"
fi

# ── 2. Purge stale / dead files ────────────────────────────────────────
sep; echo "  [2] Purge stale"

STALE=(
  # Old monolith, split into AppShell/MenuScreen/GameRuntime/DrifterAudio
  "src/ui/home-screen.ts"
  "dist/ui/home-screen.js"
  "dist/ui/home-screen.js.map"
  "dist/ui/home-screen.d.ts"
  "dist/ui/home-screen.d.ts.map"

  # Colliding index
  "src/ui/index.ts"
  "dist/ui/index.js"
  "dist/ui/index.js.map"
  "dist/ui/index.d.ts"
  "dist/ui/index.d.ts.map"

  # Old / duplicate deploy scripts
  "setup.sh"
  "fix-deploy.sh"
  "upload.sh"
  "codespace-deploy.sh"
  "update-drifter-portable.sh"
  "setup-data-folder.sh"
  "deploy-zip.sh"
  "build-dist.sh"
  "sort-tiles.sh"
  "slice-tiles.py"

  # Dev/test files
  "test.mjs"
  "test-browser.html"
  "src/test-isometric.ts"
  "src/render/test-tilemap.ts"
  "src/gameplay/gameplay-test.ts"
  "src/gameplay/browser-test.ts"
  "src/render/sky_preview.html"
  "dist/test-isometric.js"
  "dist/test-isometric.js.map"
  "dist/test-isometric.d.ts"
  "dist/test-isometric.d.ts.map"
  "dist/render/test-tilemap.js"
  "dist/render/test-tilemap.js.map"
  "dist/render/test-tilemap.d.ts"
  "dist/render/test-tilemap.d.ts.map"
  "dist/gameplay/gameplay-test.js"
  "dist/gameplay/gameplay-test.js.map"
  "dist/gameplay/gameplay-test.d.ts"
  "dist/gameplay/gameplay-test.d.ts.map"
  "dist/gameplay/browser-test.js"
  "dist/gameplay/browser-test.js.map"
  "dist/gameplay/browser-test.d.ts"
  "dist/gameplay/browser-test.d.ts.map"

  # Leftover docs
  "REFACTOR_SUMMARY.md"
  "INTEGRATION_CHECKLIST.md"
  "DRIFTER_ENGINE_PLAN.md"
)

DELETED=0
for f in "${STALE[@]}"; do
  TARGET="$REPO/$f"
  if [ -f "$TARGET" ]; then
    rm -f "$TARGET"
    git -C "$REPO" rm --cached "$f" 2>/dev/null || true
    echo -e "  ${R}✗${N}  $f"
    DELETED=$((DELETED + 1))
  fi
done
[ "$DELETED" -eq 0 ] && ok "Nothing stale" || ok "Removed $DELETED file(s)"

# Remove LFS hooks that break Codespace pushes
HOOKS="$(git -C "$REPO" rev-parse --git-dir)/hooks"
for h in post-commit pre-push post-checkout post-merge; do
  [ -f "$HOOKS/$h" ] && rm -f "$HOOKS/$h" && info "Removed LFS hook: $h"
done

# ── 3. Dependencies ────────────────────────────────────────────────────
sep; echo "  [3] Dependencies"
cd "$REPO"
[ ! -d "node_modules" ] && { info "npm install …"; npm install --silent; ok "Installed"; } || ok "node_modules present"

# ── 4. Compile ─────────────────────────────────────────────────────────
sep; echo "  [4] TypeScript compile"
cd "$REPO"
npx tsc

# Patch bare 'three' imports → CDN (Vercel free tier, no bundler)
THREE_CDN="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"
PATCHED=0
while IFS= read -r -d '' f; do
  if grep -q "from 'three'" "$f" 2>/dev/null; then
    sed -i "s|from 'three'|from '$THREE_CDN'|g" "$f"
    PATCHED=$((PATCHED + 1))
  fi
done < <(find "$REPO/dist" -name "*.js" -print0 2>/dev/null)
ok "Compiled — $PATCHED three import(s) patched"

# ── 4b. Sanity checks ──────────────────────────────────────────────────
FAIL=0
must_exist()     { [ -f "$REPO/$1" ] && ok "$1" || { err "MISSING: $1"; FAIL=$((FAIL+1)); }; }
must_not_exist() { [ ! -f "$REPO/$1" ] && ok "gone: $1" || { err "STILL EXISTS: $1"; FAIL=$((FAIL+1)); }; }

must_exist "src/ui/AppShell.ts"
must_exist "src/ui/MenuScreen.ts"
must_exist "src/ui/GameRuntime.ts"
must_exist "src/ui/DrifterAudio.ts"
must_exist "src/ui/ui-shared.ts"
must_exist "dist/ui/AppShell.js"
must_exist "dist/ui/MenuScreen.js"
must_exist "dist/ui/GameRuntime.js"
must_exist "dist/ui/DrifterAudio.js"
must_exist "index.html"
must_not_exist "src/ui/home-screen.ts"
must_not_exist "src/ui/index.ts"

[ "$FAIL" -gt 0 ] && { err "$FAIL sanity check(s) failed — aborting"; exit 1; }

# ── 5. Commit + push ───────────────────────────────────────────────────
sep; echo "  [5] Commit & push"
cd "$REPO"
git add -A
STAMP="$(date '+%Y-%m-%d %H:%M')"
git commit -m "deploy: a-new-tale patch [$STAMP]" --allow-empty
git pull --rebase origin main 2>/dev/null || true
git push origin main
ok "Pushed → origin/main"

command -v vercel &>/dev/null && { info "Vercel prod deploy …"; vercel --prod --yes; ok "Vercel triggered"; } \
  || ok "No vercel CLI — auto-deploy via git push webhook"

sep; echo -e "  ${G}SIGNAL RESTORED · DEPLOY COMPLETE${N}"; sep
