#!/usr/bin/env bash
# sort-tiles.sh
# Sorts the isometric tile sheets currently dumped in assets/buildings/tiles/
# into their intended folders, based on filename keywords:
#   *road*           -> assets/tiles/road/
#   *floor*|*carpet*|*decoration* -> assets/buildings/tiles/floors/  (interior — stays under buildings, just subfoldered)
#   everything else (grass/dirt/sand/water/ground/forest/wilderness/solid)
#                     -> assets/tiles/ground/
#
# Anything that doesn't match any rule goes to assets/tiles/_unsorted/
# instead of being silently misplaced — check that folder after running.
#
# Dry run by default — prints what WOULD move without moving anything.
# Run with --apply to actually move files.
#
# Usage:
#   bash sort-tiles.sh          # dry run, just prints the plan
#   bash sort-tiles.sh --apply  # actually moves files

set -e

SRC="assets/buildings/tiles"
DEST_GROUND="assets/tiles/ground"
DEST_ROAD="assets/tiles/road"
DEST_FLOORS="assets/buildings/tiles/floors"
DEST_UNSORTED="assets/tiles/_unsorted"

APPLY=false
if [ "$1" == "--apply" ]; then
  APPLY=true
fi

if [ ! -d "$SRC" ]; then
  echo "ERROR: $SRC not found. Run this from your repo root."
  exit 1
fi

mkdir -p "$DEST_GROUND" "$DEST_ROAD" "$DEST_FLOORS" "$DEST_UNSORTED"

moved_ground=0
moved_road=0
moved_floors=0
moved_unsorted=0

shopt -s nullglob nocaseglob
for f in "$SRC"/*.png "$SRC"/*.jpg "$SRC"/*.jpeg "$SRC"/*.webp; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  lower=$(echo "$name" | tr '[:upper:]' '[:lower:]')

  if [[ "$lower" == *road* ]]; then
    dest="$DEST_ROAD"
    moved_road=$((moved_road + 1))
  elif [[ "$lower" == *floor* || "$lower" == *carpet* || "$lower" == *decoration* ]]; then
    dest="$DEST_FLOORS"
    moved_floors=$((moved_floors + 1))
  elif [[ "$lower" == *grass* || "$lower" == *dirt* || "$lower" == *sand* || "$lower" == *water* || "$lower" == *ground* || "$lower" == *forest* || "$lower" == *wilderness* || "$lower" == *solid* ]]; then
    dest="$DEST_GROUND"
    moved_ground=$((moved_ground + 1))
  else
    dest="$DEST_UNSORTED"
    moved_unsorted=$((moved_unsorted + 1))
  fi

  if [ "$APPLY" = true ]; then
    mv "$f" "$dest/"
    echo "MOVED   $name  ->  $dest/"
  else
    echo "[dry-run] $name  ->  $dest/"
  fi
done
shopt -u nullglob nocaseglob

echo ""
echo "── summary ──"
echo "ground:    $moved_ground"
echo "road:      $moved_road"
echo "floors:    $moved_floors"
echo "unsorted:  $moved_unsorted  (check $DEST_UNSORTED if > 0)"
echo ""
if [ "$APPLY" = false ]; then
  echo "This was a DRY RUN — nothing was moved. Re-run with --apply to actually move files:"
  echo "  bash sort-tiles.sh --apply"
else
  echo "Done. $SRC should now only contain non-tile building assets (or be empty)."
fi
