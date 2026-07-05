/**
 * DRIFTER ENGINE UTILITIES
 * Seeded random, vector math, grid helpers
 */

import type { Vector2, Vector2Int, Size2 } from './types.js';

// ─── SEEDED RANDOM ───
/**
 * Mulberry32: Fast, minimal PRNG with seed
 * Returns value 0–1
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0; // Ensure 32-bit unsigned
  }

  next(): number {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Random integer in range [min, max]
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Random element from array
   */
  pick<T>(arr: T[]): T {
    return arr[this.nextInt(0, arr.length - 1)];
  }

  /**
   * Random float in range [min, max)
   */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Shuffle array in-place (Fisher-Yates)
   */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

// ─── VECTOR MATH ───
export namespace Vec2 {
  export function create(x: number = 0, y: number = 0): Vector2 {
    return { x, y };
  }

  export function add(a: Vector2, b: Vector2): Vector2 {
    return { x: a.x + b.x, y: a.y + b.y };
  }

  export function subtract(a: Vector2, b: Vector2): Vector2 {
    return { x: a.x - b.x, y: a.y - b.y };
  }

  export function multiply(v: Vector2, scalar: number): Vector2 {
    return { x: v.x * scalar, y: v.y * scalar };
  }

  export function distance(a: Vector2, b: Vector2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  export function magnitude(v: Vector2): number {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }

  export function normalize(v: Vector2): Vector2 {
    const mag = magnitude(v);
    if (mag === 0) return { x: 0, y: 0 };
    return { x: v.x / mag, y: v.y / mag };
  }

  export function clamp(v: Vector2, bounds: Size2): Vector2 {
    return {
      x: Math.max(0, Math.min(v.x, bounds.width)),
      y: Math.max(0, Math.min(v.y, bounds.height)),
    };
  }

  export function equals(a: Vector2, b: Vector2, epsilon: number = 0.0001): boolean {
    return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon;
  }
}

// ─── GRID MATH ───
export namespace Grid {
  /**
   * Check if coordinate is within grid bounds
   */
  export function inBounds(pos: Vector2Int, size: Size2): boolean {
    return pos.x >= 0 && pos.x < size.width && pos.y >= 0 && pos.y < size.height;
  }

  /**
   * Convert world position to grid cell
   */
  export function worldToGrid(worldPos: Vector2, tileSize: number = 256): Vector2Int {
    return {
      x: Math.floor(worldPos.x / tileSize),
      y: Math.floor(worldPos.y / tileSize),
    };
  }

  /**
   * Convert grid cell to world position (center)
   */
  export function gridToWorld(gridPos: Vector2Int, tileSize: number = 256): Vector2 {
    return {
      x: gridPos.x * tileSize + tileSize / 2,
      y: gridPos.y * tileSize + tileSize / 2,
    };
  }

  /**
   * Get neighboring grid cells (4-connected or 8-connected)
   */
  export function getNeighbors(
    pos: Vector2Int,
    size: Size2,
    diagonal: boolean = false
  ): Vector2Int[] {
    const neighbors: Vector2Int[] = [];
    const directions = diagonal
      ? [
          { x: 0, y: -1 }, // N
          { x: 1, y: -1 }, // NE
          { x: 1, y: 0 },  // E
          { x: 1, y: 1 },  // SE
          { x: 0, y: 1 },  // S
          { x: -1, y: 1 }, // SW
          { x: -1, y: 0 }, // W
          { x: -1, y: -1 }, // NW
        ]
      : [
          { x: 0, y: -1 }, // N
          { x: 1, y: 0 },  // E
          { x: 0, y: 1 },  // S
          { x: -1, y: 0 }, // W
        ];

    for (const dir of directions) {
      const nx = pos.x + dir.x;
      const ny = pos.y + dir.y;
      if (inBounds({ x: nx, y: ny }, size)) {
        neighbors.push({ x: nx, y: ny });
      }
    }
    return neighbors;
  }

  /**
   * Bresenham's line algorithm (grid cells between two points)
   */
  export function lineBresenham(
    from: Vector2Int,
    to: Vector2Int
  ): Vector2Int[] {
    const line: Vector2Int[] = [];
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    const sx = from.x < to.x ? 1 : -1;
    const sy = from.y < to.y ? 1 : -1;
    let err = dx - dy;

    let x = from.x;
    let y = from.y;

    while (true) {
      line.push({ x, y });
      if (x === to.x && y === to.y) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
    return line;
  }

  /**
   * Circle fill (Midpoint algorithm)
   */
  export function circleFill(center: Vector2Int, radius: number): Vector2Int[] {
    const cells: Vector2Int[] = [];
    const r2 = radius * radius;

    for (let x = -radius; x <= radius; x++) {
      for (let y = -radius; y <= radius; y++) {
        if (x * x + y * y <= r2) {
          cells.push({ x: center.x + x, y: center.y + y });
        }
      }
    }
    return cells;
  }
}

// ─── ID GENERATION ───
export namespace ID {
  /**
   * Generate branded type ID from base string
   */
  export function create<T extends string>(base: string): T {
    return `${base}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` as T;
  }

  /**
   * Generate deterministic ID from seed + type
   */
  export function deterministic(seed: number, type: string): string {
    const rng = new SeededRandom(seed);
    return `${type}-${rng.nextInt(100000, 999999)}`;
  }
}

// ─── NOISE (Perlin-like for world generation) ───
/**
 * Simple 2D value noise (not Perlin, but deterministic and smooth)
 * Returns 0–1
 */
export function valueNoise2D(x: number, y: number, seed: number): number {
  const rng = new SeededRandom(seed);
  
  // Hash the coordinates
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  // Get noise values at corners
  const n00 = rng.next();
  const n10 = rng.next();
  const n01 = rng.next();
  const n11 = rng.next();

  // Smooth interpolation (Hermite curve)
  const u = xf * xf * (3.0 - 2.0 * xf);
  const v = yf * yf * (3.0 - 2.0 * yf);

  const nx0 = n00 * (1.0 - u) + n10 * u;
  const nx1 = n01 * (1.0 - u) + n11 * u;
  return nx0 * (1.0 - v) + nx1 * v;
}

// ─── COLLISION ───
export namespace Collision {
  /**
   * AABB (axis-aligned bounding box) overlap
   */
  export function aabbOverlap(
    a: { pos: Vector2; size: Size2 },
    b: { pos: Vector2; size: Size2 }
  ): boolean {
    return (
      a.pos.x < b.pos.x + b.size.width &&
      a.pos.x + a.size.width > b.pos.x &&
      a.pos.y < b.pos.y + b.size.height &&
      a.pos.y + a.size.height > b.pos.y
    );
  }

  /**
   * Circle-circle distance check
   */
  export function circleDistance(
    a: { pos: Vector2; radius: number },
    b: { pos: Vector2; radius: number }
  ): number {
    return Vec2.distance(a.pos, b.pos) - (a.radius + b.radius);
  }

  /**
   * Point in circle
   */
  export function pointInCircle(
    point: Vector2,
    circle: { pos: Vector2; radius: number }
  ): boolean {
    return Vec2.distance(point, circle.pos) <= circle.radius;
  }

  /**
   * Point in rectangle
   */
  export function pointInRect(
    point: Vector2,
    rect: { pos: Vector2; size: Size2 }
  ): boolean {
    return (
      point.x >= rect.pos.x &&
      point.x <= rect.pos.x + rect.size.width &&
      point.y >= rect.pos.y &&
      point.y <= rect.pos.y + rect.size.height
    );
  }
}
