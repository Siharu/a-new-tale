/**
 * IsoTileMap
 * Renders the ground as a grid of flat, camera-facing tile sprites using
 * the classic 2D isometric tile-placement formula — NOT a textured 3D
 * plane. This matters because the source art (assets/tiles/ground_sliced/)
 * is pre-skewed diamond sprites authored for a 2D sprite-based isometric
 * engine (Octopath Traveler's actual technique: only characters/some props
 * are 3D, backgrounds are 2D). Laying that art flat on a 3D ground plane
 * and viewing it through IsometricRenderer's angled camera would skew it
 * a SECOND time (wrong angle on top of wrong angle) — instead, each tile
 * is oriented to face the camera directly (so its pre-baked skew renders
 * undistorted) and POSITIONED using the standard screen-space diamond
 * grid math, projected into world space via the camera's own fixed
 * right/up basis vectors.
 *
 * Camera is fixed/non-rotating (locked DRIFTER decision), so the basis
 * vectors only need to be captured once at construction — no per-frame
 * billboard recompute needed, unlike a free-rotating camera.
 *
 * This only replaces how GROUND is drawn. Buildings (SVGBuildingFactory)
 * and sky (SkySystem) are untouched — they already use real 3D geometry
 * appropriately (buildings as a stacked-plane diorama, sky as a backdrop
 * dome), since only the ground art is pre-skewed 2D-iso source material.
 */

import * as THREE from 'three';

export interface TileSet {
  [tileKey: string]: THREE.Texture;
}

export interface TileGridCell {
  tileKey: string;
  elevation?: number; // optional world-unit Y offset, e.g. for raised ground/steps later
}

export interface IsoTileMapOptions {
  camera: THREE.OrthographicCamera;
  tileSet: TileSet;
  tileWorldWidth: number;  // world units spanned by one tile's diamond bounding box, horizontally
  tileWorldHeight: number; // world units spanned vertically (the diamond's screen-space height, NOT texture pixel height)
  basePosition?: THREE.Vector3; // world-space anchor the grid is built around, default origin
}

export class IsoTileMap {
  readonly group: THREE.Group;

  private camera: THREE.OrthographicCamera;
  private tileSet: TileSet;
  private tileWorldWidth: number;
  private tileWorldHeight: number;
  private basePosition: THREE.Vector3;

  // Captured once — camera is fixed/non-rotating, so these never need
  // recomputing per frame (unlike a free camera, where billboards would
  // need to re-face every frame).
  private cameraRight: THREE.Vector3;
  private cameraUp: THREE.Vector3;
  private cameraForward: THREE.Vector3;

  private cellMeshes: Map<string, THREE.Mesh> = new Map(); // keyed "col,row"
  private sharedGeometry: THREE.PlaneGeometry;

  constructor(options: IsoTileMapOptions) {
    this.camera = options.camera;
    this.tileSet = options.tileSet;
    this.tileWorldWidth = options.tileWorldWidth;
    this.tileWorldHeight = options.tileWorldHeight;
    this.basePosition = options.basePosition ?? new THREE.Vector3(0, 0, 0);

    this.camera.updateMatrixWorld(true);
    const m = this.camera.matrixWorld;
    this.cameraRight = new THREE.Vector3().setFromMatrixColumn(m, 0).normalize();
    this.cameraUp = new THREE.Vector3().setFromMatrixColumn(m, 1).normalize();
    this.cameraForward = new THREE.Vector3().setFromMatrixColumn(m, 2).normalize(); // camera's +Z is "backward" in Three convention

    this.sharedGeometry = new THREE.PlaneGeometry(this.tileWorldWidth, this.tileWorldHeight);

    this.group = new THREE.Group();
    this.group.name = 'IsoTileMap';
  }

  /**
   * Builds (or rebuilds) the visible tile grid from a 2D array of cells.
   * grid[row][col] — row 0 is the "back" row in iso screen space (drawn
   * first / sorted behind), increasing row/col moves toward the viewer.
   */
  setGrid(grid: (TileGridCell | null)[][]): void {
    this.clear();

    for (let row = 0; row < grid.length; row++) {
      const rowCells = grid[row];
      for (let col = 0; col < rowCells.length; col++) {
        const cell = rowCells[col];
        if (!cell) continue; // null = no tile here (hole/unrevealed), skip
        this.placeTile(col, row, cell);
      }
    }
  }

  /** Place or replace a single cell without rebuilding the whole grid (e.g. streaming a zone in). */
  setCell(col: number, row: number, cell: TileGridCell | null): void {
    const key = `${col},${row}`;
    const existing = this.cellMeshes.get(key);
    if (existing) {
      this.group.remove(existing);
      (existing.material as THREE.Material).dispose();
      this.cellMeshes.delete(key);
    }
    if (cell) this.placeTile(col, row, cell);
  }

  private placeTile(col: number, row: number, cell: TileGridCell): void {
    const texture = this.tileSet[cell.tileKey];
    if (!texture) {
      console.warn(`IsoTileMap: unknown tileKey "${cell.tileKey}" at (${col}, ${row}) — skipping`);
      return;
    }

    // classic isometric screen-grid placement: diamonds interlock when
    // offset this way, regardless of the 3D camera's actual pitch angle,
    // since this is computed in camera-relative screen space, not world
    // ground space.
    const screenX = (col - row) * (this.tileWorldWidth / 2);
    const screenY = -(col + row) * (this.tileWorldHeight / 2); // screen Y grows downward; world "up" is the opposite direction
    const elevation = cell.elevation ?? 0;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false, // flat coplanar billboards — rely on renderOrder, not depth buffer, to avoid z-fighting
      side: THREE.FrontSide,
    });

    const mesh = new THREE.Mesh(this.sharedGeometry, material);

    const worldPos = this.basePosition.clone()
      .addScaledVector(this.cameraRight, screenX)
      .addScaledVector(this.cameraUp, screenY + elevation)
      // tiny forward push per depth-sort key so painter's-algorithm order
      // (back tiles first) is also reflected if depthTest is ever re-enabled
      // later; harmless no-op while depthTest stays false.
      .addScaledVector(this.cameraForward, (col + row) * 0.001);

    mesh.position.copy(worldPos);
    mesh.quaternion.copy(this.camera.quaternion);

    // painter's algorithm: tiles with a higher (col+row) are "closer" to
    // the viewer in this grid convention and must draw on top.
    mesh.renderOrder = col + row;

    this.group.add(mesh);
    this.cellMeshes.set(`${col},${row}`, mesh);
  }

  /** Removes all current tile meshes (geometry is shared/reused, only materials are disposed). */
  clear(): void {
    for (const mesh of this.cellMeshes.values()) {
      this.group.remove(mesh);
      (mesh.material as THREE.Material).dispose();
    }
    this.cellMeshes.clear();
  }

  dispose(): void {
    this.clear();
    this.sharedGeometry.dispose();
  }
}

/**
 * Loads the curated tile PNGs (assets/tiles/ground_sliced/) into a TileSet.
 * Kept separate from IsoTileMap itself so the renderer class has no
 * knowledge of specific file paths — callers decide what "grass_a" etc.
 * actually maps to on disk.
 */
export async function loadTileSet(
  basePath: string,
  tileNames: string[]
): Promise<TileSet> {
  const loader = new THREE.TextureLoader();
  const entries = await Promise.all(
    tileNames.map(
      (name) =>
        new Promise<[string, THREE.Texture]>((resolve, reject) => {
          loader.load(
            `${basePath}/${name}.png`,
            (tex) => {
              tex.colorSpace = THREE.SRGBColorSpace;
              tex.magFilter = THREE.LinearFilter;
              tex.minFilter = THREE.LinearMipmapLinearFilter;
              resolve([name, tex]);
            },
            undefined,
            (err) => reject(err instanceof Error ? err : new Error(`Failed to load tile: ${name}`))
          );
        })
    )
  );
  return Object.fromEntries(entries);
}
