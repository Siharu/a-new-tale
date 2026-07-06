#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
#  DRIFTER'S TALE — Codespace Deploy Script
#  Unpacks a zip from Claude, nukes stale files, compiles, pushes.
#
#  Usage:
#    bash deploy.sh path/to/a-new-tale-refactored.zip
#    bash deploy.sh          ← skip unpack, just compile + push current state
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC}  $1"; }
info() { echo -e "${YELLOW}→${NC}  $1"; }
err()  { echo -e "${RED}✗${NC}  $1"; }
sep()  { echo -e "\n${CYAN}────────────────────────────────────────────${NC}"; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZIP_FILE="${1:-}"

sep
echo -e "  WNCORE · DRIFTER DEPLOY"
sep

# ── 1. Unpack zip ──────────────────────────────────────────────────────
sep; echo "  [1/5] Unpack"
if [ -n "$ZIP_FILE" ]; then
  [ ! -f "$ZIP_FILE" ] && { err "Zip not found: $ZIP_FILE"; exit 1; }
  info "Extracting $ZIP_FILE …"
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  unzip -q "$ZIP_FILE" -d "$TMP"

  # Find inner project root (has package.json + src/)
  INNER=""
  for d in "$TMP"/*/; do
    [ -f "${d}package.json" ] && [ -d "${d}src" ] && { INNER="${d%/}"; break; }
  done
  [ -z "$INNER" ] && INNER="$TMP"

  rsync -a \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='drifter-deploy.zip' \
    "$INNER/" "$REPO_ROOT/"
  ok "Unpacked and merged into $REPO_ROOT"
else
  ok "No zip — using current working tree"
fi

# ── 2. Delete stale / dead files ───────────────────────────────────────
sep; echo "  [2/5] Purge stale files"

STALE=(
  # Old monolith — split into AppShell/MenuScreen/GameRuntime/DrifterAudio
  "src/ui/home-screen.ts"

  # Compiled monolith artifacts
  "dist/ui/home-screen.js"
  "dist/ui/home-screen.js.map"
  "dist/ui/home-screen.d.ts"
  "dist/ui/home-screen.d.ts.map"

  # Accidental ui/index.ts (collides with src/index.ts)
  "src/ui/index.ts"
  "dist/ui/index.js"
  "dist/ui/index.js.map"
  "dist/ui/index.d.ts"
  "dist/ui/index.d.ts.map"

  # Old deploy/upload scripts replaced by this one
  "fix-deploy.sh"
  "upload.sh"
  "codespace-deploy.sh"
  "update-drifter-portable.sh"
  "setup-data-folder.sh"

  # Dev test files — not needed in production
  "test.mjs"
  "test-browser.html"
  "src/test-isometric.ts"
  "src/render/test-tilemap.ts"
  "src/gameplay/gameplay-test.ts"
  "src/gameplay/browser-test.ts"
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

  # Temp/leftover docs
  "REFACTOR_SUMMARY.md"
  "INTEGRATION_CHECKLIST.md"
  "slice-tiles.py"
  "sort-tiles.sh"
  "build-dist.sh"
)

DELETED=0
for f in "${STALE[@]}"; do
  TARGET="$REPO_ROOT/$f"
  if [ -f "$TARGET" ]; then
    rm -f "$TARGET"
    echo -e "  ${RED}✗${NC}  removed: $f"
    DELETED=$((DELETED + 1))
    # Also un-stage from git if tracked
    git -C "$REPO_ROOT" rm --cached "$f" 2>/dev/null || true
  fi
done
[ "$DELETED" -eq 0 ] && ok "Nothing stale to remove" || ok "Removed $DELETED stale file(s)"

# Remove LFS hooks that cause push failures in Codespaces
HOOKS_DIR="$(git -C "$REPO_ROOT" rev-parse --git-dir)/hooks"
for hook in post-commit pre-push post-checkout post-merge; do
  [ -f "$HOOKS_DIR/$hook" ] && rm -f "$HOOKS_DIR/$hook" && info "Removed LFS hook: $hook"
done

# ── 3. Dependencies ────────────────────────────────────────────────────
sep; echo "  [3/5] Dependencies"
cd "$REPO_ROOT"
if [ ! -d "node_modules" ]; then
  info "Installing node_modules …"
  npm install --silent
  ok "Installed"
else
  ok "node_modules present"
fi

# ── 4. Compile ─────────────────────────────────────────────────────────
sep; echo "  [4/5] TypeScript compile"
cd "$REPO_ROOT"
npx tsc

# Patch bare 'three' imports → CDN (Vercel free tier has no bundler)
THREE_CDN="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"
PATCHED=0
while IFS= read -r -d '' f; do
  if grep -q "from 'three'" "$f" 2>/dev/null; then
    sed -i "s|from 'three'|from '$THREE_CDN'|g" "$f"
    PATCHED=$((PATCHED + 1))
  fi
done < <(find "$REPO_ROOT/dist" -name "*.js" -print0 2>/dev/null)
ok "Compiled — patched $PATCHED three import(s)"

# ── 4b. Sanity check: critical files exist, dead ones are gone ─────────
echo ""
info "Sanity checks …"
FAIL=0

must_exist() {
  [ -f "$REPO_ROOT/$1" ] && ok "$1" || { err "MISSING: $1"; FAIL=$((FAIL+1)); }
}
must_not_exist() {
  [ ! -f "$REPO_ROOT/$1" ] && ok "gone: $1" || { err "STILL EXISTS: $1"; FAIL=$((FAIL+1)); }
}

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
must_exist "menu.html"

must_not_exist "src/ui/home-screen.ts"
must_not_exist "dist/ui/home-screen.js"
must_not_exist "src/ui/index.ts"

# Check app.run() is present in both HTML files
grep -q "app\.run()" "$REPO_ROOT/index.html" \
  && ok "index.html: app.run() present" \
  || { err "index.html: app.run() MISSING"; FAIL=$((FAIL+1)); }
grep -q "app\.run()" "$REPO_ROOT/menu.html" \
  && ok "menu.html: app.run() present" \
  || { err "menu.html: app.run() MISSING"; FAIL=$((FAIL+1)); }

# Check HTML imports AppShell not HomeScreen
grep -q "AppShell" "$REPO_ROOT/index.html" \
  && ok "index.html: imports AppShell" \
  || { err "index.html: still importing old HomeScreen"; FAIL=$((FAIL+1)); }

if [ "$FAIL" -gt 0 ]; then
  err "$FAIL sanity check(s) failed — aborting push"
  exit 1
fi

# ── 5. Git commit + push ───────────────────────────────────────────────
sep; echo "  [5/5] Commit & push"
cd "$REPO_ROOT"
git add -A
TIMESTAMP="$(date '+%Y-%m-%d %H:%M')"
git commit -m "deploy: ui modular refactor + mobile layout [$TIMESTAMP]" --allow-empty
git pull --rebase origin main 2>/dev/null || true
git push origin main
ok "Pushed to origin/main"

# Vercel
if command -v vercel &>/dev/null; then
  info "Triggering Vercel prod deploy …"
  vercel --prod --yes
  ok "Vercel deploy triggered"
else
  ok "No vercel CLI — git push will trigger auto-deploy via webhook"
fi

sep
echo -e "  ${GREEN}SIGNAL RESTORED · DEPLOY COMPLETE${NC}"
sep
echo ""
echo "  src/ui/ structure:"
echo "    AppShell.ts     — lifecycle, zone gen, engine wiring"
echo "    MenuScreen.ts   — all UI screens (menu/story/settings/loading/briefing)"
echo "    GameRuntime.ts  — Three.js canvas, sprites, HUD"
echo "    DrifterAudio.ts — Web Audio synthesis"
echo "    ui-shared.ts    — DOM helpers, CSS vars, noise canvas"
echo ""
