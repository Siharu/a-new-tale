/**
 * ZoneStreamer
 * Maintains a 3×3 window of loaded zones centered on the player's current
 * zone. Zones outside the window are unloaded and their textures are evicted
 * via TextureCache. Zones entering the window are loaded from WorldGenerator.
 *
 * "Loaded" here means: the Zone object is live in memory and registered with
 * the renderer — it does NOT mean the zone is necessarily visible. The center
 * zone is the player's zone; the ring of 8 adjacent zones are pre-loaded so
 * movement into them is seamless.
 *
 * WorldGenerator is deterministic, so unloading and later reloading a zone
 * produces the identical Zone object. ZoneStreamer does NOT attempt to persist
 * runtime mutations (dropped items, opened doors) — that is WorldInfoLayer's
 * job. ZoneStreamer is purely a memory / GPU budget concern.
 *
 * Usage:
 *   const streamer = new ZoneStreamer({ generator, textureCache, onLoad, onUnload });
 *   // On player zone change:
 *   streamer.moveTo(newZoneGridPos);
 *   // Each frame (optional — fires callbacks for any pending zone transitions):
 *   streamer.flush();
 */

import type { Zone, ZoneID } from '../types.js';
import type { WorldGenerator } from '../worldgen.js';
import type { TextureCache } from '../render/TextureCache.js';

export interface ZoneStreamerOptions {
  /** The generator that produces Zone objects on demand. */
  generator: WorldGenerator;

  /** TextureCache to notify on zone unload so GPU memory is freed. */
  textureCache: TextureCache;

  /**
   * Called when a zone enters the 3×3 window (either as the player moves in
   * or on initial moveTo). The zone is fully generated and ready to use.
   * For the center zone, isCenter = true.
   */
  onLoad: (zone: Zone, isCenter: boolean) => void;

  /**
   * Called when a zone leaves the 3×3 window. The zone's textures have
   * already been evicted from TextureCache by the time this fires — callers
   * should remove any scene objects / meshes that reference this zone.
   */
  onUnload: (zoneID: ZoneID) => void;

  /**
   * Optional: override the window radius (default 1 → 3×3 grid).
   * Increase to 2 for a 5×5 window on higher-end targets.
   */
  windowRadius?: number;
}

/** Grid coordinate for a zone in the world layout. */
export interface ZoneGridPos {
  /** Column index in the world zone grid (not world-space pixels). */
  col: number;
  /** Row index in the world zone grid. */
  row: number;
}

export class ZoneStreamer {
  private readonly generator: WorldGenerator;
  private readonly textureCache: TextureCache;
  private readonly onLoad: (zone: Zone, isCenter: boolean) => void;
  private readonly onUnload: (zoneID: ZoneID) => void;
  private readonly radius: number;

  /** Currently loaded zones keyed by "col,row" grid string. */
  private loaded: Map<string, Zone> = new Map();

  /** Current center position in zone-grid space. */
  private center: ZoneGridPos | null = null;

  /** Pending zones to load on next flush() (populated by moveTo). */
  private pendingLoad: Array<{ key: string; pos: ZoneGridPos; isCenter: boolean }> = [];

  /** Pending zone IDs to unload on next flush(). */
  private pendingUnload: Array<{ key: string; zoneID: ZoneID }> = [];

  constructor(options: ZoneStreamerOptions) {
    this.generator = options.generator;
    this.textureCache = options.textureCache;
    this.onLoad = options.onLoad;
    this.onUnload = options.onUnload;
    this.radius = options.windowRadius ?? 1;
  }

  /**
   * Move the streaming window to a new center zone-grid position.
   * Queues loads/unloads; call flush() to execute them (or they run
   * automatically — flush() is called internally at the end of moveTo).
   */
  moveTo(newCenter: ZoneGridPos): void {
    const oldCenter = this.center;
    this.center = newCenter;

    const nextKeys = new Set<string>();

    // Determine the new 3×3 window.
    for (let dr = -this.radius; dr <= this.radius; dr++) {
      for (let dc = -this.radius; dc <= this.radius; dc++) {
        const pos: ZoneGridPos = { col: newCenter.col + dc, row: newCenter.row + dr };
        const key = gridKey(pos);
        nextKeys.add(key);

        if (!this.loaded.has(key)) {
          const isCenter = dc === 0 && dr === 0;
          this.pendingLoad.push({ key, pos, isCenter });
        } else if (dc === 0 && dr === 0 && oldCenter && !samePos(oldCenter, newCenter)) {
          // Already loaded but is now the center — fire onLoad with isCenter=true
          // so callers can update their "active zone" reference without a full reload.
          const zone = this.loaded.get(key)!;
          this.onLoad(zone, true);
        }
      }
    }

    // Anything currently loaded that's outside the new window → unload.
    for (const [key, zone] of this.loaded) {
      if (!nextKeys.has(key)) {
        this.pendingUnload.push({ key, zoneID: zone.id });
      }
    }

    this.flush();
  }

  /**
   * Execute all pending loads and unloads. Safe to call every frame —
   * it's a no-op when no transitions are pending.
   */
  flush(): void {
    // Unloads first — free memory before allocating new zones.
    for (const { key, zoneID } of this.pendingUnload) {
      this.loaded.delete(key);
      this.textureCache.evictZone(zoneID as any);
      this.onUnload(zoneID);
    }
    this.pendingUnload = [];

    for (const { key, pos, isCenter } of this.pendingLoad) {
      const zone = this.generateZoneAt(pos);
      if (zone) {
        this.loaded.set(key, zone);
        this.onLoad(zone, isCenter);
      }
    }
    this.pendingLoad = [];
  }

  /** The currently active center zone (if moveTo has been called). */
  get centerZone(): Zone | null {
    if (!this.center) return null;
    return this.loaded.get(gridKey(this.center)) ?? null;
  }

  /** All zones currently in the streaming window. */
  get activeZones(): Zone[] {
    return Array.from(this.loaded.values());
  }

  /** How many zones are currently loaded. */
  get loadedCount(): number {
    return this.loaded.size;
  }

  // ─── internal ───

  /**
   * Ask the WorldGenerator for the zone at a given grid position.
   * WorldGenerator.generate() returns all zones at once from a flat array;
   * we map grid position → array index using the generator's zone layout.
   * If the position is outside the generated world bounds, returns null
   * (edge-of-world handling — caller simply doesn't load that slot).
   */
  private generateZoneAt(pos: ZoneGridPos): Zone | null {
    // WorldGenerator exposes the world via generate(), which returns the full
    // zone array. We call it (it's cheap — deterministic + cached internally)
    // and pick the zone whose grid position matches. The generator places
    // zones on a grid starting at (0,0); positions outside the generated
    // count silently return null.
    const { zones } = this.generator.generate();

    // WorldGenerator lays zones out in row-major order matching the zoneGrid
    // array it builds internally. We reconstruct the expected index.
    const zoneCount = zones.length;
    const gridSize = Math.ceil(Math.sqrt(zoneCount)); // e.g. 6 zones → 3×3 grid (padded)

    if (pos.col < 0 || pos.row < 0 || pos.col >= gridSize || pos.row >= gridSize) {
      return null;
    }

    const index = pos.row * gridSize + pos.col;
    return zones[index] ?? null;
  }
}

// ─── helpers ───

function gridKey(pos: ZoneGridPos): string {
  return `${pos.col},${pos.row}`;
}

function samePos(a: ZoneGridPos, b: ZoneGridPos): boolean {
  return a.col === b.col && a.row === b.row;
}
