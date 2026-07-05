import type {
  Drifter,
  Item,
  Interactable,
  Run,
  RunID,
  StoryHook,
  Vector2,
  Zone,
} from '../types.js';
import { DrifterRoster } from './DrifterRoster.js';
import { DrifterEntity } from './DrifterEntity.js';
import { MovementController } from './MovementController.js';
import { InteractionSystem } from './InteractionSystem.js';
import { CatalogSystem } from './CatalogSystem.js';
import { InventorySystem } from './InventorySystem.js';
import { HuskSystem, HuskSystemOptions } from './HuskSystem.js';
import { WorldInfoLayer, WorldInfoDeposit, WorldInfoLayerOptions } from './WorldInfoLayer.js';
import { RunManager } from './RunManager.js';
import type { ThreatDetectionContext } from './ThreatModel.js';
import { ZoneStreamer, type ZoneStreamerOptions } from './ZoneStreamer.js';
import { TextureCache, type TextureCacheOptions } from '../render/TextureCache.js';
import { SVGRasterizer } from '../render/SVGRasterizer.js';
import { SVGBuildingFactory } from '../render/SVGBuildingFactory.js';
import { WorldGenerator } from '../worldgen.js';

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

export class GameplayEngine {
  public drifterEntity: DrifterEntity;
  public drifter: Drifter;
  public movementController: MovementController;
  public interactionSystem: InteractionSystem;
  public catalogSystem: CatalogSystem;
  public inventorySystem: InventorySystem;
  public huskSystem: HuskSystem;
  public worldInfoLayer: WorldInfoLayer;
  public runManager: RunManager;
  public currentRun: Run;

  /** Shared rasterizer — single instance, reused across all building bakes. */
  public readonly rasterizer: SVGRasterizer;
  /** LRU texture cache wired to the rasterizer. */
  public readonly textureCache: TextureCache;
  /** Building factory with TextureCache wired in. */
  public readonly buildingFactory: SVGBuildingFactory;
  /** Zone streaming window — call moveTo() on zone transition. */
  public readonly zoneStreamer: ZoneStreamer;

  private roster: DrifterRoster;
  private depositCountThisRun = 0;
  private maxDepositsPerRun: number;

  constructor(options: GameplayEngineOptions) {
    this.roster = new DrifterRoster(options.rosterSeed ?? options.seed);
    this.drifterEntity = this.roster.drawDrifter('run-0' as RunID, options.zone.id, options.startPosition);
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
    this.buildingFactory = new SVGBuildingFactory(
      this.rasterizer,
      256,
      256,
      this.textureCache,
    );

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
      onLoad: options.zoneStreamerCallbacks?.onLoad ?? ((_zone, _isCenter) => {}),
      onUnload: options.zoneStreamerCallbacks?.onUnload ?? ((_zoneID) => {}),
    });
  }

  public update(deltaSeconds: number, input: Vector2, obstacles: Array<{ position: Vector2; size: { width: number; height: number } }>): void {
    this.movementController.setInput(input);
    this.movementController.update(deltaSeconds);

    const threatContext: ThreatDetectionContext = {
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

  public pickUpItem(item: Item | unknown): boolean {
    if (!this.inventorySystem.canAddItem(this.drifter, item as Item)) {
      return false;
    }
    const picked = this.inventorySystem.addItem(this.drifter, item as Item);
    if (picked) {
      const entry = this.catalogSystem.createEntryForItem(this.drifter.drifterSeed, item as Item, (item as Item).position);
      this.drifterEntity.addLogbookEntry(entry);
      this.runManager.recordResource(item);
      this.runManager.recordLogbookEntry(entry);
    }
    return picked;
  }

  public investigateInteractable(interactable: Interactable): void {
    const entry = this.interactionSystem.interactWithInteractable(this.drifter, interactable);
    this.drifterEntity.addLogbookEntry(entry);
    this.runManager.recordLogbookEntry(entry);
  }

  public investigateStoryHook(hook: StoryHook): void {
    const entry = this.interactionSystem.interactWithStoryHook(this.drifter, hook);
    this.drifterEntity.addLogbookEntry(entry);
    this.runManager.recordLogbookEntry(entry);
  }

  public addWorldInfoDeposit(deposit: Omit<WorldInfoDeposit, 'id' | 'createdAt'>): WorldInfoDeposit | null {
    if (this.depositCountThisRun >= this.maxDepositsPerRun) {
      return null;
    }
    const record = this.worldInfoLayer.addDeposit(deposit);
    this.depositCountThisRun += 1;
    return record;
  }

  public getDepositsForZone(zoneType: string, region?: string): WorldInfoDeposit[] {
    return this.worldInfoLayer.getDepositsForZone(zoneType as any, region);
  }

  public failRun(cause: string): Run | null {
    return this.runManager.failRun(cause);
  }

  public completeRun(): Run | null {
    return this.runManager.completeRun();
  }

  public getCurrentRunSummary() {
    return this.runManager.getHistory();
  }

  public getDrifter(): Drifter {
    return this.drifter;
  }
}
