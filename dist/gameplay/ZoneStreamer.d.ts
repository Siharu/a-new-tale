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
export declare class ZoneStreamer {
    private readonly generator;
    private readonly textureCache;
    private readonly onLoad;
    private readonly onUnload;
    private readonly radius;
    /** Currently loaded zones keyed by "col,row" grid string. */
    private loaded;
    /** Current center position in zone-grid space. */
    private center;
    /** Pending zones to load on next flush() (populated by moveTo). */
    private pendingLoad;
    /** Pending zone IDs to unload on next flush(). */
    private pendingUnload;
    constructor(options: ZoneStreamerOptions);
    /**
     * Move the streaming window to a new center zone-grid position.
     * Queues loads/unloads; call flush() to execute them (or they run
     * automatically — flush() is called internally at the end of moveTo).
     */
    moveTo(newCenter: ZoneGridPos): void;
    /**
     * Execute all pending loads and unloads. Safe to call every frame —
     * it's a no-op when no transitions are pending.
     */
    flush(): void;
    /** The currently active center zone (if moveTo has been called). */
    get centerZone(): Zone | null;
    /** All zones currently in the streaming window. */
    get activeZones(): Zone[];
    /** How many zones are currently loaded. */
    get loadedCount(): number;
    /**
     * Ask the WorldGenerator for the zone at a given grid position.
     * WorldGenerator.generate() returns all zones at once from a flat array;
     * we map grid position → array index using the generator's zone layout.
     * If the position is outside the generated world bounds, returns null
     * (edge-of-world handling — caller simply doesn't load that slot).
     */
    private generateZoneAt;
}
//# sourceMappingURL=ZoneStreamer.d.ts.map