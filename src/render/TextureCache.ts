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

export class TextureCache {
  private readonly rasterizer: SVGRasterizer;
  private readonly maxEntries: number;

  /**
   * LRU order: front = most-recently-used, back = least-recently-used.
   * We keep keys in insertion order and move-to-front on touch().
   * A plain Map preserves insertion order and lets us iterate from oldest
   * to newest — perfect for LRU with O(1) amortized access.
   */
  private readonly lru: Map<string, true> = new Map();

  /** cacheKey → set of zoneIDs that registered it (a key can be shared). */
  private readonly keyToZones: Map<string, Set<ZoneID>> = new Map();

  /** zoneID → set of cacheKeys registered under it. */
  private readonly zoneToKeys: Map<ZoneID, Set<string>> = new Map();

  constructor(rasterizer: SVGRasterizer, options: TextureCacheOptions = {}) {
    this.rasterizer = rasterizer;
    this.maxEntries = options.maxEntries ?? 256;
  }

  /**
   * Associate a cacheKey with a zoneID before baking.
   * Call this once per key/zone pair; registering the same pair twice is safe.
   */
  registerKey(cacheKey: string, zoneID: ZoneID): void {
    // Key → zone mapping
    let zones = this.keyToZones.get(cacheKey);
    if (!zones) {
      zones = new Set();
      this.keyToZones.set(cacheKey, zones);
    }
    zones.add(zoneID);

    // Zone → key mapping
    let keys = this.zoneToKeys.get(zoneID);
    if (!keys) {
      keys = new Set();
      this.zoneToKeys.set(zoneID, keys);
    }
    keys.add(cacheKey);
  }

  /**
   * Mark a cacheKey as most-recently-used. Call after every
   * rasterizer.bakeImmediate() / rasterizer.rebake() that uses this key.
   * Triggers LRU eviction if the cache is over capacity.
   */
  touch(cacheKey: string): void {
    // Move to front by deleting and re-inserting (Map preserves insertion order).
    this.lru.delete(cacheKey);
    this.lru.set(cacheKey, true);

    this.enforceCapacity();
  }

  /**
   * Evict all textures registered under a zoneID and remove their LRU
   * entries. Call on zone unload. Zone with no registered keys is a no-op.
   */
  evictZone(zoneID: ZoneID): void {
    const keys = this.zoneToKeys.get(zoneID);
    if (!keys) return;

    for (const key of keys) {
      // Only fully evict the key if this was the last zone referencing it.
      const zones = this.keyToZones.get(key);
      if (zones) {
        zones.delete(zoneID);
        if (zones.size === 0) {
          this.keyToZones.delete(key);
          this.lru.delete(key);
          this.rasterizer.evict(key);
        }
      }
    }

    this.zoneToKeys.delete(zoneID);
  }

  /**
   * Evict a single key regardless of zone association. Removes the zone
   * reverse-index entries as well.
   */
  evictKey(cacheKey: string): void {
    const zones = this.keyToZones.get(cacheKey);
    if (zones) {
      for (const zoneID of zones) {
        this.zoneToKeys.get(zoneID)?.delete(cacheKey);
      }
      this.keyToZones.delete(cacheKey);
    }
    this.lru.delete(cacheKey);
    this.rasterizer.evict(cacheKey);
  }

  /** Drop everything — call on scene teardown. */
  clear(): void {
    this.lru.clear();
    this.keyToZones.clear();
    this.zoneToKeys.clear();
    this.rasterizer.clear();
  }

  get entryCount(): number {
    return this.lru.size;
  }

  // ─── internal ───

  private enforceCapacity(): void {
    while (this.lru.size > this.maxEntries) {
      // First key in Map = least-recently-used.
      const lruKey = this.lru.keys().next().value;
      if (lruKey === undefined) break;
      this.evictKey(lruKey);
    }
  }
}
