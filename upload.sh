#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# DRIFTER — upload.sh
# Drop drifter-s-tale-main.zip anywhere, run this script from the same folder.
# It will find the zip, extract it, and overwrite all matching files in your
# Codespace repo — no manual copying needed.
#
# Usage (from the repo root or wherever you dropped the zip):
#   bash upload.sh
#   bash upload.sh /path/to/drifter-s-tale-main.zip   ← if zip is elsewhere
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── colour helpers ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC}  $1"; }
info() { echo -e "${YELLOW}→${NC}  $1"; }
err()  { echo -e "${RED}✗${NC}  $1"; }
head_line() { echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

head_line
echo -e "  DRIFTER — upload & overwrite script"
head_line

# ── 1. Locate the zip ─────────────────────────────────────────────────────────
ZIP_PATH="${1:-}"

if [[ -z "$ZIP_PATH" ]]; then
  # Auto-detect: search current dir + repo root for the zip
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  for candidate in \
    "$SCRIPT_DIR/drifter-s-tale-main.zip" \
    "$SCRIPT_DIR/drifter-s-tale-clean.zip" \
    "$(pwd)/drifter-s-tale-main.zip" \
    "$(pwd)/drifter-s-tale-clean.zip"
  do
    if [[ -f "$candidate" ]]; then
      ZIP_PATH="$candidate"
      break
    fi
  done
fi

if [[ -z "$ZIP_PATH" || ! -f "$ZIP_PATH" ]]; then
  err "Could not find drifter-s-tale-main.zip"
  echo "    Drop the zip in the same folder as this script, or pass its path:"
  echo "    bash upload.sh /path/to/drifter-s-tale-main.zip"
  exit 1
fi

ok "Found zip: $ZIP_PATH"

# ── 2. Detect repo root (where package.json + src/ live) ─────────────────────
REPO_ROOT=""
# Walk up from script location
CHECK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for _ in 1 2 3 4 5; do
  if [[ -f "$CHECK_DIR/package.json" && -d "$CHECK_DIR/src" ]]; then
    REPO_ROOT="$CHECK_DIR"
    break
  fi
  CHECK_DIR="$(dirname "$CHECK_DIR")"
done

# If not found walking up, try from pwd
if [[ -z "$REPO_ROOT" ]]; then
  CHECK_DIR="$(pwd)"
  for _ in 1 2 3 4 5; do
    if [[ -f "$CHECK_DIR/package.json" && -d "$CHECK_DIR/src" ]]; then
      REPO_ROOT="$CHECK_DIR"
      break
    fi
    CHECK_DIR="$(dirname "$CHECK_DIR")"
  done
fi

if [[ -z "$REPO_ROOT" ]]; then
  err "Could not find repo root (package.json + src/ not found in parent dirs)"
  echo "    Run this script from inside the drifter-s-tale repo."
  exit 1
fi

ok "Repo root: $REPO_ROOT"

# ── 3. Extract to temp dir ────────────────────────────────────────────────────
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

info "Extracting zip..."
unzip -q "$ZIP_PATH" -d "$TMP_DIR"

# ── 4. Find the top-level folder inside the zip ───────────────────────────────
# The zip may contain drifter-s-tale-main/ or drifter-s-tale-clean/ at its root.
# We locate the folder that has src/ and package.json inside it.
SRC_ROOT=""
for d in "$TMP_DIR"/*/; do
  if [[ -f "${d}package.json" && -d "${d}src" ]]; then
    SRC_ROOT="${d%/}"
    break
  fi
done

if [[ -z "$SRC_ROOT" ]]; then
  err "Zip structure unexpected — could not find package.json + src/ inside zip"
  echo "    Contents of zip root:"
  ls "$TMP_DIR/"
  exit 1
fi

ok "Zip contents root: $(basename "$SRC_ROOT")"

# ── 5. Copy files over ───────────────────────────────────────────────────────
# Strategy: walk every file inside the extracted folder and copy it to the
# matching path under REPO_ROOT, creating directories as needed.
# Binary files (images, audio) are copied only if they differ (size check).
# Text/source files are always overwritten.

echo ""
info "Copying files into repo..."

UPDATED=0
SKIPPED=0

while IFS= read -r -d '' src_file; do
  # Path relative to the zip's root folder
  rel="${src_file#"$SRC_ROOT/"}"

  # Skip .gitkeep (just directory markers, not content)
  [[ "$rel" == *".gitkeep" ]] && continue

  dest_file="$REPO_ROOT/$rel"
  dest_dir="$(dirname "$dest_file")"

  # Create destination directory if needed
  mkdir -p "$dest_dir"

  # For binary assets (png, jpg, mp3, wav, ogg), skip if identical size
  # (avoids re-writing huge unchanged PNGs; full md5 would be too slow)
  ext="${src_file##*.}"
  if [[ "$ext" =~ ^(png|jpg|jpeg|gif|webp|mp3|wav|ogg|woff|woff2|ttf)$ ]]; then
    if [[ -f "$dest_file" ]]; then
      src_size=$(wc -c < "$src_file")
      dst_size=$(wc -c < "$dest_file")
      if [[ "$src_size" == "$dst_size" ]]; then
        ((SKIPPED++)) || true
        continue
      fi
    fi
  fi

  cp "$src_file" "$dest_file"
  echo -e "  ${GREEN}+${NC} $rel"
  ((UPDATED++)) || true

done < <(find "$SRC_ROOT" -type f -print0)

echo ""
ok "$UPDATED file(s) written, $SKIPPED binary file(s) unchanged (same size)"

# ── 6. Quick sanity checks ────────────────────────────────────────────────────
head_line
echo -e "  Sanity checks"
head_line

PASS=0; FAIL=0

check() {
  local label="$1"; local path="$REPO_ROOT/$2"
  if [[ -f "$path" ]]; then
    ok "$label"
    ((PASS++)) || true
  else
    err "MISSING: $label ($2)"
    ((FAIL++)) || true
  fi
}

check "assets/DRIFTER_ENGINE_PLAN.md"                     "assets/DRIFTER_ENGINE_PLAN.md"
check "menu.html (cinematic menu)"                        "menu.html"
check "index.html"                                        "index.html"
check "src/ui/home-screen.ts"                             "src/ui/home-screen.ts"
check "src/gameplay/GameplayEngine.ts"                    "src/gameplay/GameplayEngine.ts"
check "src/gameplay/ZoneStreamer.ts"                      "src/gameplay/ZoneStreamer.ts"
check "src/render/TextureCache.ts"                        "src/render/TextureCache.ts"
check "src/data/husk_records.ts"                          "src/data/husk_records.ts"
check "src/data/fact_pools.ts"                            "src/data/fact_pools.ts"
check "src/data/relay_station.json"                       "src/data/relay_station.json"
check "assets/wncorelastbastion.png (menu background)"    "assets/wncorelastbastion.png"
check "package.json"                                      "package.json"
check "tsconfig.json"                                     "tsconfig.json"
check "vercel.json"                                       "vercel.json"
check "deploy.sh"                                         "deploy.sh"

# Confirm junk files are absent
echo ""
info "Checking removed test files are gone..."
for f in \
  "drifter-s-tale-fixed.zip" \
  "test.mjs" \
  "test-browser.html" \
  "src/render/test-tilemap.ts" \
  "src/test-isometric.ts" \
  "src/gameplay/gameplay-test.ts" \
  "src/gameplay/browser-test.ts"
do
  if [[ -f "$REPO_ROOT/$f" ]]; then
    err "Junk file still present: $f  ← delete it manually"
    ((FAIL++)) || true
  fi
done
ok "No stale test files"

# ── 7. tower dot calibration spot-check ──────────────────────────────────────
if grep -q "66.1%" "$REPO_ROOT/menu.html" 2>/dev/null; then
  ok "menu.html tower dot calibrated (66.1% / 28.3%)"
else
  err "menu.html tower dot may still be at old placeholder position"
  ((FAIL++)) || true
fi

# ── 8. bg image path spot-check ──────────────────────────────────────────────
if grep -q "url('./assets/wncorelastbastion.png')" "$REPO_ROOT/menu.html" 2>/dev/null; then
  ok "menu.html bg image path correct (assets/wncorelastbastion.png)"
else
  err "menu.html bg image path may be wrong"
  ((FAIL++)) || true
fi

# ── 9. Done ──────────────────────────────────────────────────────────────────
head_line
if [[ $FAIL -eq 0 ]]; then
  echo -e "  ${GREEN}All checks passed ($PASS/$PASS).${NC}"
  echo -e "  Run ${CYAN}npm run type-check${NC} to confirm zero TS errors."
  echo -e "  Open ${CYAN}menu.html${NC} directly in browser to preview the cinematic menu."
else
  echo -e "  ${YELLOW}$PASS passed, ${RED}$FAIL failed${NC} — check output above."
fi
head_line
echo ""
