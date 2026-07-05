import type { Drifter, Item, Interactable, Run, StoryHook, Vector2, Zone } from '../types.js';
import { DrifterEntity } from './DrifterEntity.js';
import { MovementController } from './MovementController.js';
import { InteractionSystem } from './InteractionSystem.js';
import { CatalogSystem } from './CatalogSystem.js';
import { InventorySystem } from './InventorySystem.js';
import { HuskSystem, HuskSystemOptions } from './HuskSystem.js';
import { WorldInfoLayer, WorldInfoDeposit, WorldInfoLayerOptions } from './WorldInfoLayer.js';
import { RunManager } from './RunManager.js';
import { ZoneStreamer, type ZoneStreamerOptions } from './ZoneStreamer.js';
import { TextureCache, type TextureCacheOptions } from '../render/TextureCache.js';
import { SVGRasterizer } from '../render/SVGRasterizer.js';
import { SVGBuildingFactory } from '../render/SVGBuildingFactory.js';
export interface GameplayEngineOptions {
    seed: number;
    zone: Zone;
    startPosition: Vector2;
    maxDepositsPerRun?: number;
    huskOptions?: HuskSystemOptions;
    worldInfoOptions?: WorldInfoLayerOptions;
    rosterSeed?: number;
    /** TextureCache capacity override — defaults to 256 entries. */
    textureCacheOptions?: TextureCacheOptions;
    /** Callbacks for ZoneStreamer zone load/unload events. */
    zoneStreamerCallbacks?: Pick<ZoneStreamerOptions, 'onLoad' | 'onUnload'>;
}
export declare class GameplayEngine {
    drifterEntity: DrifterEntity;
    drifter: Drifter;
    movementController: MovementController;
    interactionSystem: InteractionSystem;
    catalogSystem: CatalogSystem;
    inventorySystem: InventorySystem;
    huskSystem: HuskSystem;
    worldInfoLayer: WorldInfoLayer;
    runManager: RunManager;
    currentRun: Run;
    /** Shared rasterizer — single instance, reused across all building bakes. */
    readonly rasterizer: SVGRasterizer;
    /** LRU texture cache wired to the rasterizer. */
    readonly textureCache: TextureCache;
    /** Building factory with TextureCache wired in. */
    readonly buildingFactory: SVGBuildingFactory;
    /** Zone streaming window — call moveTo() on zone transition. */
    readonly zoneStreamer: ZoneStreamer;
    private roster;
    private depositCountThisRun;
    private maxDepositsPerRun;
    constructor(options: GameplayEngineOptions);
    update(deltaSeconds: number, input: Vector2, obstacles: Array<{
        position: Vector2;
        size: {
            width: number;
            height: number;
        };
    }>): void;
    pickUpItem(item: Item | unknown): boolean;
    investigateInteractable(interactable: Interactable): void;
    investigateStoryHook(hook: StoryHook): void;
    addWorldInfoDeposit(deposit: Omit<WorldInfoDeposit, 'id' | 'createdAt'>): WorldInfoDeposit | null;
    getDepositsForZone(zoneType: string, region?: string): WorldInfoDeposit[];
    failRun(cause: string): Run | null;
    completeRun(): Run | null;
    getCurrentRunSummary(): import("../types.js").RunSummary[];
    getDrifter(): Drifter;
}
//# sourceMappingURL=GameplayEngine.d.ts.map