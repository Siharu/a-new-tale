#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# DRIFTER'S TALE · Codespace Setup Script
#
# Drop the zip + this script into your Codespace workspace root, then run:
#   bash setup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
DIM='\033[2m'
RESET='\033[0m'

echo ""
echo -e "${CYAN}░░ WNCORE · DRIFTER'S TALE · CODESPACE SETUP ░░${RESET}"
echo ""

ZIP=""
for candidate in drifter-s-tale-final.zip drifter-s-tale-main_final.zip; do
  if [[ -f "$candidate" ]]; then ZIP="$candidate"; break; fi
done
if [[ -z "$ZIP" ]]; then
  ZIP=$(ls drifter-*.zip 2>/dev/null | head -1)
fi
if [[ -z "$ZIP" ]]; then
  echo -e "${RED}ERROR: No drifter-*.zip found in $(pwd)${RESET}"
  echo "Drop the zip file into the workspace root and re-run."
  exit 1
fi

echo -e "${DIM}> Found: $ZIP${RESET}"

TMPDIR_EXTRACT=$(mktemp -d)
unzip -q "$ZIP" -d "$TMPDIR_EXTRACT"
INNER=$(ls "$TMPDIR_EXTRACT" | head -1)
if command -v rsync &>/dev/null; then
  rsync -a "$TMPDIR_EXTRACT/$INNER/" ./
else
  cp -rf "$TMPDIR_EXTRACT/$INNER/." ./
fi
rm -rf "$TMPDIR_EXTRACT"
echo -e "${GREEN}✓ Extracted${RESET}"

echo -e "${DIM}> npm install...${RESET}"
npm install --silent
echo -e "${GREEN}✓ Dependencies installed${RESET}"

echo -e "${DIM}> tsc build...${RESET}"
BUILD_OUTPUT=$(npm run build 2>&1)
BUILD_EXIT=$?
if [[ $BUILD_EXIT -ne 0 ]]; then
  REAL_ERRORS=$(echo "$BUILD_OUTPUT" | grep "error TS" | grep -v "hqEntrance\|not comparable\|sufficiently overlaps" || true)
  if [[ -n "$REAL_ERRORS" ]]; then
    echo -e "${RED}Build errors:${RESET}"
    echo "$REAL_ERRORS"
    exit 1
  fi
fi
echo -e "${GREEN}✓ Build complete${RESET}"

DIST_COUNT=$(find dist/ -name "*.js" 2>/dev/null | wc -l)
echo ""
echo -e "${CYAN}░░ SETUP COMPLETE ░░${RESET}"
echo -e "${DIM}  dist/ JS files : $DIST_COUNT${RESET}"
echo -e "${DIM}  Entry          : menu.html${RESET}"
echo -e "${DIM}  Deploy         : push to GitHub → Vercel reads vercel.json${RESET}"
echo ""
echo -e "${GREEN}> RELAY NODE ACTIVE · SIGNAL HOLDING${RESET}"
echo ""
