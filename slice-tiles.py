#!/usr/bin/env python3
"""
slice-tiles.py
Slices specific diamond-tile cells out of the packed sheet PNGs in
assets/tiles/ground/, chroma-keys the pure-black background to
transparent, and saves each as a standalone tile PNG in
assets/tiles/ground_sliced/.

This is a curated, hand-picked selection (5 base tiles) rather than an
"extract everything" dump, per the "refine 4-5 tiles we reuse everywhere"
plan -- more sheets/cells can be added to TILES below later the same way.

Requires Pillow: pip install pillow

Usage (run from repo root):
    python3 slice-tiles.py
"""

from PIL import Image
import os

SRC_DIR = "assets/tiles/ground"
OUT_DIR = "assets/tiles/ground_sliced"

# Each entry: (sheet filename, cols, rows, cell_w, cell_h, [(row, col, output_name), ...])
TILES = [
    (
        "1 Basic Ground - 256x144.png", 4, 1, 256, 144,
        [
            (0, 1, "stone_basic"),
            (0, 2, "grass_a"),
            (0, 3, "dirt_a"),
        ],
    ),
    (
        "2 Ground - Rocky 256x128.png", 3, 5, 256, 128,
        [
            (2, 1, "stone_rocky_grey"),
        ],
    ),
    (
        "1 Forests 256x128.png", 3, 6, 256, 128,
        [
            (0, 0, "forest_a"),
        ],
    ),
]

def diamond_mask_alpha(im: Image.Image, edge_softness: int = 2) -> Image.Image:
    """
    Cuts the image to the exact iso-diamond shape using geometry, not color.
    Color-based chroma-keying is wrong here: these textures (rock/grass) have
    plenty of naturally near-black shadow pixels INSIDE the diamond, which a
    black-threshold key would incorrectly punch transparent holes into. The
    diamond's bounding box is precision-packed in these sheets (vertices touch
    the cell edges at top/right/bottom/left-center), so a pure geometric test
    is both simpler and correct.
    """
    im = im.convert("RGBA")
    pixels = im.load()
    w, h = im.size
    cx, cy = w / 2, h / 2

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            # normalized diamond (taxicab) distance: 0 at center, 1 at the diamond edge
            d = abs(x + 0.5 - cx) / cx + abs(y + 0.5 - cy) / cy
            if d <= 1.0 - edge_softness / max(w, h):
                pixels[x, y] = (r, g, b, 255)
            elif d <= 1.0 + edge_softness / max(w, h):
                # thin anti-aliasing ramp right at the diamond boundary only
                t = 1.0 - (d - (1.0 - edge_softness / max(w, h))) / (2 * edge_softness / max(w, h))
                pixels[x, y] = (r, g, b, max(0, min(255, int(255 * t))))
            else:
                pixels[x, y] = (r, g, b, 0)
    return im


def main():
    if not os.path.isdir(SRC_DIR):
        raise SystemExit(f"ERROR: {SRC_DIR} not found. Run this from your repo root.")
    os.makedirs(OUT_DIR, exist_ok=True)

    for filename, cols, rows, cell_w, cell_h, cells in TILES:
        path = os.path.join(SRC_DIR, filename)
        if not os.path.isfile(path):
            print(f"SKIP (not found): {filename}")
            continue

        sheet = Image.open(path)
        expected_w, expected_h = cols * cell_w, rows * cell_h
        if sheet.size != (expected_w, expected_h):
            print(f"WARNING: {filename} is {sheet.size}, expected {(expected_w, expected_h)} -- cropping anyway, double-check output")

        for row, col, out_name in cells:
            box = (col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h)
            cell = sheet.crop(box)
            cell = diamond_mask_alpha(cell)
            out_path = os.path.join(OUT_DIR, f"{out_name}.png")
            cell.save(out_path)
            print(f"saved {out_path}  (from {filename} row{row} col{col})")

    print("\nDone.")


if __name__ == "__main__":
    main()
