import * as THREE from 'three';
/** Eight directional vectors for sprite orientation (in world coordinates). */
export declare const DIRECTIONS: {
    readonly NORTH: {
        readonly x: 0;
        readonly y: -1;
        readonly name: "north";
    };
    readonly NORTHEAST: {
        readonly x: 1;
        readonly y: -1;
        readonly name: "northeast";
    };
    readonly EAST: {
        readonly x: 1;
        readonly y: 0;
        readonly name: "east";
    };
    readonly SOUTHEAST: {
        readonly x: 1;
        readonly y: 1;
        readonly name: "southeast";
    };
    readonly SOUTH: {
        readonly x: 0;
        readonly y: 1;
        readonly name: "south";
    };
    readonly SOUTHWEST: {
        readonly x: -1;
        readonly y: 1;
        readonly name: "southwest";
    };
    readonly WEST: {
        readonly x: -1;
        readonly y: 0;
        readonly name: "west";
    };
    readonly NORTHWEST: {
        readonly x: -1;
        readonly y: -1;
        readonly name: "northwest";
    };
    readonly IDLE: {
        readonly x: 0;
        readonly y: 0;
        readonly name: "idle";
    };
};
export type Direction = typeof DIRECTIONS[keyof typeof DIRECTIONS];
/**
 * Maps a 2D input vector to the closest cardinal/diagonal direction.
 * Returns IDLE if magnitude is negligible.
 */
export declare function vectorToDirection(x: number, y: number): Direction;
/**
 * Options for sprite loading/animation.
 */
export interface SpriteConfig {
    /** How many frames per direction (e.g. 4 = 4 directions × 4 frames = 16 total tiles). */
    framesPerDirection: number;
    /** FPS for animation playback. */
    animationFps: number;
    /** If true, sprite is a horizontal strip (directions side-by-side).
     *  If false, vertical strip (directions stacked top-to-bottom). */
    horizontalLayout: boolean;
    /** Fallback color if image fails to load. */
    fallbackColor?: number;
}
/**
 * Loads an image as a canvas-backed THREE.CanvasTexture (for browser compatibility),
 * then creates a sprite mesh with animation driven by input direction.
 *
 * Two modes:
 * - Spritesheet mode (initialize): frames laid out in a grid, 8 direction rows.
 * - Directional-stills mode (initializeDirectional): one PNG per direction,
 *   matching the real asset sets on disk. Facing swaps instantly; idle keeps
 *   the last facing. Walk-cycle spritesheets can replace this later without
 *   touching callers.
 *
 * Geometry: Always creates a Plane (billboard).
 * Lighting: Material is unlit so the character is always readable.
 */
export declare class SpriteAnimator {
    private texture;
    private mesh;
    private canvas;
    private config;
    private animationTime;
    private currentDirection;
    private frameIndex;
    private canvas2d;
    private sourceImage;
    /** Width/height of a single frame in pixels (set after image loads). */
    private frameWidth;
    private frameHeight;
    /** Directional-stills mode state. */
    private directionalImages;
    private lastFacingFile;
    private static readonly DIRECTION_FILES;
    constructor(config: SpriteConfig);
    /**
     * Load image from URL and initialize the sprite mesh (spritesheet mode).
     * Returns the Three.js Mesh ready to add to scene.
     */
    initialize(imagePath: string, width?: number, height?: number): Promise<THREE.Mesh>;
    /**
     * Load one still PNG per direction from `basePath` (north.png, north-east.png,
     * east.png, south-east.png, south.png, south-west.png, west.png, north-west.png)
     * and initialize the sprite mesh (directional-stills mode). Missing directions
     * fall back to south / whatever loaded. Throws only if nothing loads.
     */
    initializeDirectional(basePath: string, width?: number, height?: number): Promise<THREE.Mesh>;
    /**
     * Update animation based on direction and elapsed time.
     * Should be called once per frame (tick).
     */
    update(deltaSeconds: number, inputDirection: Direction): void;
    /** Draw the still for a facing; idle keeps the last non-idle facing. */
    private drawDirectionalFrame;
    /**
     * Draw a specific frame to the canvas texture (spritesheet mode).
     * Frame indexing: `directionIndex * framesPerDirection + frameIndex`.
     */
    private drawFrame;
    private getDirectionIndex;
    getMesh(): THREE.Mesh | null;
    dispose(): void;
}
//# sourceMappingURL=SpriteAnimator.d.ts.map