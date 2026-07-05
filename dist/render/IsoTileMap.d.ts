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
    elevation?: number;
}
export interface IsoTileMapOptions {
    camera: THREE.OrthographicCamera;
    tileSet: TileSet;
    tileWorldWidth: number;
    tileWorldHeight: number;
    basePosition?: THREE.Vector3;
}
export declare class IsoTileMap {
    readonly group: THREE.Group;
    private camera;
    private tileSet;
    private tileWorldWidth;
    private tileWorldHeight;
    private basePosition;
    private cameraRight;
    private cameraUp;
    private cameraForward;
    private cellMeshes;
    private sharedGeometry;
    constructor(options: IsoTileMapOptions);
    /**
     * Builds (or rebuilds) the visible tile grid from a 2D array of cells.
     * grid[row][col] — row 0 is the "back" row in iso screen space (drawn
     * first / sorted behind), increasing row/col moves toward the viewer.
     */
    setGrid(grid: (TileGridCell | null)[][]): void;
    /** Place or replace a single cell without rebuilding the whole grid (e.g. streaming a zone in). */
    setCell(col: number, row: number, cell: TileGridCell | null): void;
    private placeTile;
    /** Removes all current tile meshes (geometry is shared/reused, only materials are disposed). */
    clear(): void;
    dispose(): void;
}
/**
 * Loads the curated tile PNGs (assets/tiles/ground_sliced/) into a TileSet.
 * Kept separate from IsoTileMap itself so the renderer class has no
 * knowledge of specific file paths — callers decide what "grass_a" etc.
 * actually maps to on disk.
 */
export declare function loadTileSet(basePath: string, tileNames: string[]): Promise<TileSet>;
//# sourceMappingURL=IsoTileMap.d.ts.map