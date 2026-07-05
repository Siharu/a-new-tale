/**
 * TextureCache
 * LRU eviction layer over SVGRasterizer's internal Map. SVGRasterizer already
 * caches by cacheKey, but has no eviction policy — the cache grows unbounded
 * as zones load. TextureCache wraps it with a capacity limit and evicts the
 * least-recently-used entry whenever the limit is exceeded, calling
 * SVGRasterizer.evict() so GPU memory is released at the same time.
 *
 * This is the policy side; SVGRasterizer is the mechanism side. ZoneStreamer
 * calls TextureCache.evictZone() on zone unload, which drops all keys that
 * were registered under that zone — keeping the lifecycle tied to zone load/
 * unload rather than requiring callers to track individual cache keys.
 *
 * Usage:
 *   const tc = new TextureCache(rasterizer, { maxEntries: 256 });
 *   // Before baking, register the zone association:
 *   tc.registerKey(cacheKey, zoneID);
 *   // Then bake as normal through the rasterizer — TextureCache tracks LRU:
 *   const tex = rasterizer.bakeImmediate(svg, { cacheKey, width, height });
 *   tc.touch(cacheKey);
 *   // On zone unload:
 *   tc.evictZone(zoneID);
 */
import type { ZoneID } from '../types.js';
import type { SVGRasterizer } from './SVGRasterizer.js';
export interface TextureCacheOptions {
    /**
     * Maximum number of texture entries to keep alive at once.
     * When the limit is exceeded the LRU entry is evicted.
     * Default: 256. Tune lower on memory-constrained devices.
     */
    maxEntries?: number;
}
export declare class TextureCache {
    private readonly rasterizer;
    private readonly maxEntries;
    /**
     * LRU order: front = most-recently-used, back = least-recently-used.
     * We keep keys in insertion order and move-to-front on touch().
     * A plain Map preserves insertion order and lets us iterate from oldest
     * to newest — perfect for LRU with O(1) amortized access.
     */
    private readonly lru;
    /** cacheKey → set of zoneIDs that registered it (a key can be shared). */
    private readonly keyToZones;
    /** zoneID → set of cacheKeys registered under it. */
    private readonly zoneToKeys;
    constructor(rasterizer: SVGRasterizer, options?: TextureCacheOptions);
    /**
     * Associate a cacheKey with a zoneID before baking.
     * Call this once per key/zone pair; registering the same pair twice is safe.
     */
    registerKey(cacheKey: string, zoneID: ZoneID): void;
    /**
     * Mark a cacheKey as most-recently-used. Call after every
     * rasterizer.bakeImmediate() / rasterizer.rebake() that uses this key.
     * Triggers LRU eviction if the cache is over capacity.
     */
    touch(cacheKey: string): void;
    /**
     * Evict all textures registered under a zoneID and remove their LRU
     * entries. Call on zone unload. Zone with no registered keys is a no-op.
     */
    evictZone(zoneID: ZoneID): void;
    /**
     * Evict a single key regardless of zone association. Removes the zone
     * reverse-index entries as well.
     */
    evictKey(cacheKey: string): void;
    /** Drop everything — call on scene teardown. */
    clear(): void;
    get entryCount(): number;
    private enforceCapacity;
}
//# sourceMappingURL=TextureCache.d.ts.map