/**
 * DRIFTER ENGINE UTILITIES
 * Seeded random, vector math, grid helpers
 */
// ─── SEEDED RANDOM ───
/**
 * Mulberry32: Fast, minimal PRNG with seed
 * Returns value 0–1
 */
export class SeededRandom {
    constructor(seed) {
        this.seed = seed >>> 0; // Ensure 32-bit unsigned
    }
    next() {
        let t = (this.seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    /**
     * Random integer in range [min, max]
     */
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
    /**
     * Random element from array
     */
    pick(arr) {
        return arr[this.nextInt(0, arr.length - 1)];
    }
    /**
     * Random float in range [min, max)
     */
    nextFloat(min, max) {
        return this.next() * (max - min) + min;
    }
    /**
     * Shuffle array in-place (Fisher-Yates)
     */
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = this.nextInt(0, i);
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}
// ─── VECTOR MATH ───
export var Vec2;
(function (Vec2) {
    function create(x = 0, y = 0) {
        return { x, y };
    }
    Vec2.create = create;
    function add(a, b) {
        return { x: a.x + b.x, y: a.y + b.y };
    }
    Vec2.add = add;
    function subtract(a, b) {
        return { x: a.x - b.x, y: a.y - b.y };
    }
    Vec2.subtract = subtract;
    function multiply(v, scalar) {
        return { x: v.x * scalar, y: v.y * scalar };
    }
    Vec2.multiply = multiply;
    function distance(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    Vec2.distance = distance;
    function magnitude(v) {
        return Math.sqrt(v.x * v.x + v.y * v.y);
    }
    Vec2.magnitude = magnitude;
    function normalize(v) {
        const mag = magnitude(v);
        if (mag === 0)
            return { x: 0, y: 0 };
        return { x: v.x / mag, y: v.y / mag };
    }
    Vec2.normalize = normalize;
    function clamp(v, bounds) {
        return {
            x: Math.max(0, Math.min(v.x, bounds.width)),
            y: Math.max(0, Math.min(v.y, bounds.height)),
        };
    }
    Vec2.clamp = clamp;
    function equals(a, b, epsilon = 0.0001) {
        return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon;
    }
    Vec2.equals = equals;
})(Vec2 || (Vec2 = {}));
// ─── GRID MATH ───
export var Grid;
(function (Grid) {
    /**
     * Check if coordinate is within grid bounds
     */
    function inBounds(pos, size) {
        return pos.x >= 0 && pos.x < size.width && pos.y >= 0 && pos.y < size.height;
    }
    Grid.inBounds = inBounds;
    /**
     * Convert world position to grid cell
     */
    function worldToGrid(worldPos, tileSize = 256) {
        return {
            x: Math.floor(worldPos.x / tileSize),
            y: Math.floor(worldPos.y / tileSize),
        };
    }
    Grid.worldToGrid = worldToGrid;
    /**
     * Convert grid cell to world position (center)
     */
    function gridToWorld(gridPos, tileSize = 256) {
        return {
            x: gridPos.x * tileSize + tileSize / 2,
            y: gridPos.y * tileSize + tileSize / 2,
        };
    }
    Grid.gridToWorld = gridToWorld;
    /**
     * Get neighboring grid cells (4-connected or 8-connected)
     */
    function getNeighbors(pos, size, diagonal = false) {
        const neighbors = [];
        const directions = diagonal
            ? [
                { x: 0, y: -1 }, // N
                { x: 1, y: -1 }, // NE
                { x: 1, y: 0 }, // E
                { x: 1, y: 1 }, // SE
                { x: 0, y: 1 }, // S
                { x: -1, y: 1 }, // SW
                { x: -1, y: 0 }, // W
                { x: -1, y: -1 }, // NW
            ]
            : [
                { x: 0, y: -1 }, // N
                { x: 1, y: 0 }, // E
                { x: 0, y: 1 }, // S
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
    Grid.getNeighbors = getNeighbors;
    /**
     * Bresenham's line algorithm (grid cells between two points)
     */
    function lineBresenham(from, to) {
        const line = [];
        const dx = Math.abs(to.x - from.x);
        const dy = Math.abs(to.y - from.y);
        const sx = from.x < to.x ? 1 : -1;
        const sy = from.y < to.y ? 1 : -1;
        let err = dx - dy;
        let x = from.x;
        let y = from.y;
        while (true) {
            line.push({ x, y });
            if (x === to.x && y === to.y)
                break;
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
    Grid.lineBresenham = lineBresenham;
    /**
     * Circle fill (Midpoint algorithm)
     */
    function circleFill(center, radius) {
        const cells = [];
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
    Grid.circleFill = circleFill;
})(Grid || (Grid = {}));
// ─── ID GENERATION ───
export var ID;
(function (ID) {
    /**
     * Generate branded type ID from base string
     */
    function create(base) {
        return `${base}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    ID.create = create;
    /**
     * Generate deterministic ID from seed + type
     */
    function deterministic(seed, type) {
        const rng = new SeededRandom(seed);
        return `${type}-${rng.nextInt(100000, 999999)}`;
    }
    ID.deterministic = deterministic;
})(ID || (ID = {}));
// ─── NOISE (Perlin-like for world generation) ───
/**
 * Simple 2D value noise (not Perlin, but deterministic and smooth)
 * Returns 0–1
 */
export function valueNoise2D(x, y, seed) {
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
export var Collision;
(function (Collision) {
    /**
     * AABB (axis-aligned bounding box) overlap
     */
    function aabbOverlap(a, b) {
        return (a.pos.x < b.pos.x + b.size.width &&
            a.pos.x + a.size.width > b.pos.x &&
            a.pos.y < b.pos.y + b.size.height &&
            a.pos.y + a.size.height > b.pos.y);
    }
    Collision.aabbOverlap = aabbOverlap;
    /**
     * Circle-circle distance check
     */
    function circleDistance(a, b) {
        return Vec2.distance(a.pos, b.pos) - (a.radius + b.radius);
    }
    Collision.circleDistance = circleDistance;
    /**
     * Point in circle
     */
    function pointInCircle(point, circle) {
        return Vec2.distance(point, circle.pos) <= circle.radius;
    }
    Collision.pointInCircle = pointInCircle;
    /**
     * Point in rectangle
     */
    function pointInRect(point, rect) {
        return (point.x >= rect.pos.x &&
            point.x <= rect.pos.x + rect.size.width &&
            point.y >= rect.pos.y &&
            point.y <= rect.pos.y + rect.size.height);
    }
    Collision.pointInRect = pointInRect;
})(Collision || (Collision = {}));
//# sourceMappingURL=utils.js.map