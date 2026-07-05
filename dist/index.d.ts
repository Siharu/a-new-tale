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
export * from './types.js';
export { SeededRandom, Vec2, Grid, ID, valueNoise2D, Collision } from './utils.js';
export { WorldGenerator } from './worldgen.js';
export * from './gameplay/index.js';
//# sourceMappingURL=index.d.ts.map