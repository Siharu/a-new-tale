/**
 * DRIFTER ENGINE
 * Main export point
 *
 * Usage:
 * import { WorldGenerator, type WorldGenOptions } from './index.js';
 *
 * const gen = new WorldGenerator({
 *   seed: 12345,
 *   zoneCount: 12,
 *   difficulty: 5,
 *   era: 'Peak Decay',
 * });
 *
 * const { zones, hqPosition } = gen.generate();
 */
// ── Types ──
export * from './types.js';
// ── Utilities ──
export { SeededRandom, Vec2, Grid, ID, valueNoise2D, Collision } from './utils.js';
// ── Core Classes ──
export { WorldGenerator } from './worldgen.js';
// ── Gameplay ──
export * from './gameplay/index.js';
//# sourceMappingURL=index.js.map