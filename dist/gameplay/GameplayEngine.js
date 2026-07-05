import { DrifterRoster } from './DrifterRoster.js';
import { MovementController } from './MovementController.js';
import { InteractionSystem } from './InteractionSystem.js';
import { CatalogSystem } from './CatalogSystem.js';
import { InventorySystem } from './InventorySystem.js';
import { HuskSystem } from './HuskSystem.js';
import { WorldInfoLayer } from './WorldInfoLayer.js';
import { RunManager } from './RunManager.js';
import { ZoneStreamer } from './ZoneStreamer.js';
import { TextureCache } from '../render/TextureCache.js';
import { SVGRasterizer } from '../render/SVGRasterizer.js';
import { SVGBuildingFactory } from '../render/SVGBuildingFactory.js';
import { WorldGenerator } from '../worldgen.js';
export class GameplayEngine {
    constructor(options) {
        this.depositCountThisRun = 0;
        this.roster = new DrifterRoster(options.rosterSeed ?? options.seed);
        this.drifterEntity = this.roster.drawDrifter('run-0', options.zone.id, options.startPosition);
        this.drifter = this.drifterEntity.drifter;
        this.movementController = new MovementController({
            drifter: this.drifter,
            zone: options.zone,
            building: null,
        });
        this.interactionSystem = new InteractionSystem();
        this.catalogSystem = new CatalogSystem();
        this.inventorySystem = new InventorySystem();
        this.huskSystem = new HuskSystem({
            seed: options.seed,
            zone: options.zone,
            huskCount: options.huskOptions?.huskCount ?? 4,
            weather: options.huskOptions?.weather ?? options.zone.weatherState,
            groupChance: options.huskOptions?.groupChance,
        });
        this.worldInfoLayer = new WorldInfoLayer(options.worldInfoOptions);
        this.runManager = new RunManager({
            seed: options.seed,
            hqPosition: { x: options.startPosition.x, y: options.startPosition.y },
        });
        this.maxDepositsPerRun = options.maxDepositsPerRun ?? 4;
        this.currentRun = this.runManager.startRun(this.drifter, options.zone);
        // ── Rendering infrastructure ──────────────────────────────────────────────
        this.rasterizer = new SVGRasterizer();
        this.textureCache = new TextureCache(this.rasterizer, options.textureCacheOptions);
        this.buildingFactory = new SVGBuildingFactory(this.rasterizer, 256, 256, this.textureCache);
        // ── Zone streamer — starts at grid position (0,0); caller should call
        //    moveTo() with the actual starting grid position if known. ──────────
        this.zoneStreamer = new ZoneStreamer({
            generator: new WorldGenerator({
                seed: options.seed,
                zoneCount: 6,
                difficulty: 5,
                era: 'Early Collapse',
            }),
            textureCache: this.textureCache,
            onLoad: options.zoneStreamerCallbacks?.onLoad ?? ((_zone, _isCenter) => { }),
            onUnload: options.zoneStreamerCallbacks?.onUnload ?? ((_zoneID) => { }),
        });
    }
    update(deltaSeconds, input, obstacles) {
        this.movementController.setInput(input);
        this.movementController.update(deltaSeconds);
        const threatContext = {
            drifterNoise: 0.6,
            ambientNoise: 0.4,
            timeOfDay: this.currentRun.worldTimeOfDay,
            weather: this.huskSystem['weather'] ?? this.currentRun.worldTimeOfDay,
            obstacles,
        };
        this.huskSystem.update(deltaSeconds, this.drifter, threatContext);
        this.drifter.signalStrength = Math.max(0, this.drifter.signalStrength - deltaSeconds * 0.2);
        this.drifter.airQuality = Math.max(0, this.drifter.airQuality - deltaSeconds * 0.1);
    }
    pickUpItem(item) {
        if (!this.inventorySystem.canAddItem(this.drifter, item)) {
            return false;
        }
        const picked = this.inventorySystem.addItem(this.drifter, item);
        if (picked) {
            const entry = this.catalogSystem.createEntryForItem(this.drifter.drifterSeed, item, item.position);
            this.drifterEntity.addLogbookEntry(entry);
            this.runManager.recordResource(item);
            this.runManager.recordLogbookEntry(entry);
        }
        return picked;
    }
    investigateInteractable(interactable) {
        const entry = this.interactionSystem.interactWithInteractable(this.drifter, interactable);
        this.drifterEntity.addLogbookEntry(entry);
        this.runManager.recordLogbookEntry(entry);
    }
    investigateStoryHook(hook) {
        const entry = this.interactionSystem.interactWithStoryHook(this.drifter, hook);
        this.drifterEntity.addLogbookEntry(entry);
        this.runManager.recordLogbookEntry(entry);
    }
    addWorldInfoDeposit(deposit) {
        if (this.depositCountThisRun >= this.maxDepositsPerRun) {
            return null;
        }
        const record = this.worldInfoLayer.addDeposit(deposit);
        this.depositCountThisRun += 1;
        return record;
    }
    getDepositsForZone(zoneType, region) {
        return this.worldInfoLayer.getDepositsForZone(zoneType, region);
    }
    failRun(cause) {
        return this.runManager.failRun(cause);
    }
    completeRun() {
        return this.runManager.completeRun();
    }
    getCurrentRunSummary() {
        return this.runManager.getHistory();
    }
    getDrifter() {
        return this.drifter;
    }
}
//# sourceMappingURL=GameplayEngine.js.map