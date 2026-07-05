#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# DRIFTER deploy.sh
# Drop drifter-s-tale-fixed.zip in the repo root, then run:
#   bash deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZIP_NAME="drifter-s-tale-fixed.zip"
ZIP_PATH="$REPO_ROOT/$ZIP_NAME"
TMP_DIR="$REPO_ROOT/.deploy_tmp"

# ── colour helpers ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
info() { echo -e "${YELLOW}→${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  DRIFTER — deploy script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. sanity check ───────────────────────────────────────────────────────────
[[ -f "$ZIP_PATH" ]] || fail "Could not find $ZIP_NAME in repo root ($REPO_ROOT)"
command -v unzip &>/dev/null || fail "unzip not found — run: sudo apt-get install -y unzip"
command -v npm   &>/dev/null || fail "npm not found"
ok "Found $ZIP_NAME"

# ── 2. extract to temp ────────────────────────────────────────────────────────
info "Extracting zip..."
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"
unzip -q "$ZIP_PATH" -d "$TMP_DIR"

# handle single wrapper folder (zip may be repo/ or drifter-s-tale-main/ etc.)
EXTRACT_ROOT="$TMP_DIR"
ENTRIES=("$TMP_DIR"/*)
if [[ ${#ENTRIES[@]} -eq 1 && -d "${ENTRIES[0]}" ]]; then
  EXTRACT_ROOT="${ENTRIES[0]}"
  info "Detected wrapper folder: $(basename "$EXTRACT_ROOT")"
fi
ok "Extracted to temp dir"

# ── 3. ensure all required folders exist ─────────────────────────────────────
info "Creating folder structure..."
DIRS=(
  src/data/npc_scripts
  src/data/world_info
  src/gameplay
  src/render
  src/ui
  assets/audio/music/ambient
  assets/audio/music/extraction
  assets/audio/music/tension
  assets/audio/sfx/footsteps
  assets/audio/sfx/hazard
  assets/audio/sfx/radio
  assets/audio/sfx/ui
  assets/audio/voice
  assets/buildings/generated_cache
  assets/buildings/templates
  "assets/buildings/tiles/floors"
  assets/characters/drifter/base
  assets/characters/drifter/variants
  assets/characters/husks/isometric/shambler
  assets/characters/husks/isometric/sprinter
  assets/characters/husks/isometric/bloated
  assets/characters/husks/silhouettes
  assets/fx/noise
  assets/fx/particles
  assets/items
  assets/props
  assets/tiles/ground
  assets/tiles/ground_sliced
  assets/tiles/road
  assets/tiles/rubble
  "assets/ui/fonts/gameicons"
  assets/ui/hud
  assets/ui/logbook
  "assets/ui/menubackground/background 1"
  "assets/ui/menubackground/background 2"
  "assets/ui/menubackground/background 3"
  "assets/ui/menubackground/background 4"
  assets/weapons/meleeweps
  dist
  ui
)
for dir in "${DIRS[@]}"; do
  mkdir -p "$REPO_ROOT/$dir"
done
ok "Folder structure ready"

# ── 4. copy src files (always overwrite) ─────────────────────────────────────
info "Copying source files..."
if [[ -d "$EXTRACT_ROOT/src" ]]; then
  cp -r "$EXTRACT_ROOT/src/." "$REPO_ROOT/src/"
  ok "src/ updated"
else
  echo "  (no src/ in zip — skipping)"
fi

# ── 5. copy config / root files (overwrite) ──────────────────────────────────
info "Copying root config files..."
ROOT_FILES=(
  package.json
  tsconfig.json
  vercel.json
  index.html
  test-browser.html
  test.mjs
  setup-data-folder.sh
  slice-tiles.py
  sort-tiles.sh
  SETUP_README.md
  .gitignore
  .devcontainer/devcontainer.json
)
for f in "${ROOT_FILES[@]}"; do
  src="$EXTRACT_ROOT/$f"
  dst="$REPO_ROOT/$f"
  if [[ -f "$src" ]]; then
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
  fi
done
ok "Root config files updated"

# ── 6. copy assets (only overwrite existing, never wipe whole folder) ─────────
info "Merging assets..."
if [[ -d "$EXTRACT_ROOT/assets" ]]; then
  # rsync-style: copy everything from zip assets into repo assets, keep extras
  cp -rn "$EXTRACT_ROOT/assets/." "$REPO_ROOT/assets/" 2>/dev/null || true
  # force-overwrite tile/item/weapon PNGs since those may have changed
  for subdir in tiles items weapons/meleeweps "ui/menubackground" "ui/fonts/gameicons" "buildings/tiles"; do
    src_dir="$EXTRACT_ROOT/assets/$subdir"
    dst_dir="$REPO_ROOT/assets/$subdir"
    if [[ -d "$src_dir" ]]; then
      mkdir -p "$dst_dir"
      cp -r "$src_dir/." "$dst_dir/"
    fi
  done
  ok "Assets merged"
else
  echo "  (no assets/ in zip — skipping)"
fi

# ── 7. npm install ────────────────────────────────────────────────────────────
info "Running npm install..."
cd "$REPO_ROOT"
npm install --silent
ok "Dependencies installed"

# ── 8. type-check ────────────────────────────────────────────────────────────
info "Running type check..."
npm run type-check
ok "Type check passed — zero errors"

# ── 9. build ─────────────────────────────────────────────────────────────────
info "Building..."
npm run build
ok "Build complete → dist/"

# ── 10. cleanup ──────────────────────────────────────────────────────────────
rm -rf "$TMP_DIR"
ok "Temp dir cleaned up"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}All done. Repo is up to date.${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
