#!/bin/bash

# Setup data folder structure for DRIFTER Phase 3
# Run in Codespaces root: bash setup-data-folder.sh

set -e

echo "Creating src/data/ folder structure..."

# Create main data folder
mkdir -p src/data

# Create subfolders for organized data (optional, for future expansion)
mkdir -p src/data/npc_scripts
mkdir -p src/data/maps
mkdir -p src/data/world_info

# Add .gitkeep to track empty folders (optional)
touch src/data/npc_scripts/.gitkeep
touch src/data/world_info/.gitkeep

echo "✓ src/data/ folder structure created"
echo ""
echo "Folder structure:"
echo "  src/data/"
echo "    ├── husk_records.ts           (threat taxonomy — write here)"
echo "    ├── fact_pools.ts             (catalog entry text — write here)"
echo "    ├── relay_station.json        (first playable map — write here)"
echo "    ├── npc_scripts/              (for future NPC dialogue)"
echo "    ├── maps/                     (for additional hand-authored zones)"
echo "    └── world_info/               (for cross-run deposit system)"
echo ""
echo "Next steps:"
echo "  1. Copy husk_records.ts into src/data/"
echo "  2. Copy fact_pools.ts into src/data/"
echo "  3. Copy relay_station.json into src/data/"
echo "  4. Run: npm run type-check && npm run build"
echo ""
