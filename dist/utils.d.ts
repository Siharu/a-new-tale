/**
 * DRIFTER ENGINE UTILITIES
 * Seeded random, vector math, grid helpers
 */
import type { Vector2, Vector2Int, Size2 } from './types.js';
/**
 * Mulberry32: Fast, minimal PRNG with seed
 * Returns value 0–1
 */
export declare class SeededRandom {
    private seed;
    constructor(seed: number);
    next(): number;
    /**
     * Random integer in range [min, max]
     */
    nextInt(min: number, max: number): number;
    /**
     * Random element from array
     */
    pick<T>(arr: T[]): T;
    /**
     * Random float in range [min, max)
     */
    nextFloat(min: number, max: number): number;
    /**
     * Shuffle array in-place (Fisher-Yates)
     */
    shuffle<T>(arr: T[]): T[];
}
export declare namespace Vec2 {
    function create(x?: number, y?: number): Vector2;
    function add(a: Vector2, b: Vector2): Vector2;
    function subtract(a: Vector2, b: Vector2): Vector2;
    function multiply(v: Vector2, scalar: number): Vector2;
    function distance(a: Vector2, b: Vector2): number;
    function magnitude(v: Vector2): number;
    function normalize(v: Vector2): Vector2;
    function clamp(v: Vector2, bounds: Size2): Vector2;
    function equals(a: Vector2, b: Vector2, epsilon?: number): boolean;
}
export declare namespace Grid {
    /**
     * Check if coordinate is within grid bounds
     */
    function inBounds(pos: Vector2Int, size: Size2): boolean;
    /**
     * Convert world position to grid cell
     */
    function worldToGrid(worldPos: Vector2, tileSize?: number): Vector2Int;
    /**
     * Convert grid cell to world position (center)
     */
    function gridToWorld(gridPos: Vector2Int, tileSize?: number): Vector2;
    /**
     * Get neighboring grid cells (4-connected or 8-connected)
     */
    function getNeighbors(pos: Vector2Int, size: Size2, diagonal?: boolean): Vector2Int[];
    /**
     * Bresenham's line algorithm (grid cells between two points)
     */
    function lineBresenham(from: Vector2Int, to: Vector2Int): Vector2Int[];
    /**
     * Circle fill (Midpoint algorithm)
     */
    function circleFill(center: Vector2Int, radius: number): Vector2Int[];
}
export declare namespace ID {
    /**
     * Generate branded type ID from base string
     */
    function create<T extends string>(base: string): T;
    /**
     * Generate deterministic ID from seed + type
     */
    function deterministic(seed: number, type: string): string;
}
/**
 * Simple 2D value noise (not Perlin, but deterministic and smooth)
 * Returns 0–1
 */
export declare function valueNoise2D(x: number, y: number, seed: number): number;
export declare namespace Collision {
    /**
     * AABB (axis-aligned bounding box) overlap
     */
    function aabbOverlap(a: {
        pos: Vector2;
        size: Size2;
    }, b: {
        pos: Vector2;
        size: Size2;
    }): boolean;
    /**
     * Circle-circle distance check
     */
    function circleDistance(a: {
        pos: Vector2;
        radius: number;
    }, b: {
        pos: Vector2;
        radius: number;
    }): number;
    /**
     * Point in circle
     */
    function pointInCircle(point: Vector2, circle: {
        pos: Vector2;
        radius: number;
    }): boolean;
    /**
     * Point in rectangle
     */
    function pointInRect(point: Vector2, rect: {
        pos: Vector2;
        size: Size2;
    }): boolean;
}
//# sourceMappingURL=utils.d.ts.map