#!/bin/bash

# DRIFTER Update Script (Pure Bash - No rsync required)
# Drops a zip file in the repo and safely merges/overwrites files

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ZIP_FILE="${1:-drifter-s-tale-main.zip}"
REPO_ROOT="${2:-.}"
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}  DRIFTER Repository Update${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""

# Validation
[ -f "$ZIP_FILE" ] || { echo -e "${RED}✗ Zip not found: $ZIP_FILE${NC}"; exit 1; }
[ -d "$REPO_ROOT" ] || { echo -e "${RED}✗ Repo root not found: $REPO_ROOT${NC}"; exit 1; }

echo -e "${YELLOW}→ Extracting zip file...${NC}"
unzip -q "$ZIP_FILE" -d "$TEMP_DIR"

EXTRACTED_DIR=$(find "$TEMP_DIR" -maxdepth 1 -type d ! -name "$TEMP_DIR" | head -1)
[ -n "$EXTRACTED_DIR" ] || { echo -e "${RED}✗ Extraction failed${NC}"; exit 1; }

# Check if extracted dir contains a single subfolder (common with zips)
# If so, use that subfolder's contents instead
INNER_DIR=$(find "$EXTRACTED_DIR" -maxdepth 1 -type d ! -name "$EXTRACTED_DIR" | head -1)
if [ -n "$INNER_DIR" ]; then
    SOURCE_DIR="$INNER_DIR"
else
    SOURCE_DIR="$EXTRACTED_DIR"
fi

echo -e "${GREEN}✓ Extracted successfully${NC}"

FILE_COUNT=$(find "$SOURCE_DIR" -type f | wc -l)
FOLDER_COUNT=$(find "$SOURCE_DIR" -type d | wc -l)
echo -e "${YELLOW}→ Processing $FILE_COUNT files across $FOLDER_COUNT folders...${NC}"

# Copy everything from source to repo root (overwrite existing)
for item in "$SOURCE_DIR"/*; do
    if [ -e "$item" ]; then
        cp -r "$item" "$REPO_ROOT/"
    fi
done

echo -e "${GREEN}✓ Files merged successfully${NC}"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Update Complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "Processed: ${GREEN}$FILE_COUNT${NC} files | ${GREEN}$FOLDER_COUNT${NC} folders"
echo ""
echo "Next: git status && git add . && git commit -m 'Update DRIFTER assets'"