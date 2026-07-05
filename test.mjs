import { WorldGenerator } from './dist/index.js';
const gen = new WorldGenerator({ seed: 42, zoneCount: 6, difficulty: 5, era: 'Peak Decay' });
const { zones, hqPosition } = gen.generate();
console.log(`✓ ${zones.length} zones, HQ at (${hqPosition.x}, ${hqPosition.y})`);
