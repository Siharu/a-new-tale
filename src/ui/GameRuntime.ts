import * as THREE from 'three';
import type { Zone, ZoneID, Item } from '../types.js';
import type { GameplayEngine } from '../gameplay/index.js';
import type { HuskEntity } from '../gameplay/HuskSystem.js';
import { HuskState } from '../gameplay/HuskSystem.js';
import { IsometricRenderer } from '../render/IsometricRenderer.js';
import { CinematicCamera, type OrbitOptions } from '../render/CinematicCamera.js';
import { SkySystem } from '../render/SkySystem.js';
import { SpriteAnimator, vectorToDirection } from '../render/SpriteAnimator.js';
import { BROADCAST_LINES, WHISPER_LINES } from '../data/broadcasts.js';
import type { DrifterAudio } from './DrifterAudio.js';

/** Color per HuskType — behavioral/visual read only, never the real mechanism.
 *  Keys match the HuskType enum's string values (uppercase). */
const HUSK_COLOR: Record<string, number> = {
  SKOTH: 0x8a4a4a,
  GLOWBUBS: 0xd9c86a,
  JAWIES: 0x6a4a8a,
  WHITES: 0xe8e4d8,
  OLDBONES: 0x7a6a5a,
  DISABLED: 0x5a5a5a,
  NOIRE: 0x1a1a1f,
  BLOATERS: 0x8a6a3a,
  AQUATIC: 0x3a6a7a,
};
const HUSK_COLOR_DEFAULT = 0x9a3a3a;

/** HuskTypes with real isometric 8-direction sprite sets on disk
 *  (assets/characters/husks/isometric/<folder>). Everything else keeps the
 *  color-coded geometric fallback until assets arrive — asset gap, not a
 *  code gap (glowbubs, whites, oldbones, disabled, bloaters, aquatic). */
const HUSK_SPRITE_FOLDERS: Record<string, string[]> = {
  SKOTH: ['skoth'],
  NOIRE: ['noire'],
  JAWIES: ['jawie-bulky', 'jawie-slim'],
};

// ── Goal system ─────────────────────────────────────────────────────────────
/** Number of items the drifter must catalog before extraction unlocks. */
const CATALOG_GOAL = 3;
/** How close the drifter must be (world units) to pick up an item. */
const PICKUP_RADIUS = 80;
/** Damage per second while a husk is in ATTACKING state and within range. */
const HUSK_ATTACK_DPS = 22;
/** Footstep sound interval in seconds. */
const FOOTSTEP_INTERVAL = 0.38;

/** Ground tile per zone type — real tile art from assets/tiles/ground_sliced.
 *  Rural relays read as overgrown grass, industry as rocky stone, etc. */
const ZONE_GROUND_TILE: Record<string, string> = {
  RESIDENTIAL_DISTRICT: 'stone_basic',
  INDUSTRIAL_COMPLEX: 'stone_rocky_grey',
  RURAL_RELAY: 'grass_a',
  SIGNAL_HUB: 'dirt_a',
  ARCHIVE: 'stone_basic',
  RUINS: 'dirt_a',
};

/** World-grid → local scene bounds. Buildings/husks/drifter all share this. */
const SCENE_HALF_EXTENT = 6;

const MINIMAP_SIZE = 176;
const WORLDMAP_W = 460;
const WORLDMAP_H = 340;

function worldToScene(pos: { x: number; y: number }, maxDimension: number): { x: number; z: number } {
  return {
    x: (pos.x / maxDimension) * (SCENE_HALF_EXTENT * 2) - SCENE_HALF_EXTENT,
    z: (pos.y / maxDimension) * (SCENE_HALF_EXTENT * 2) - SCENE_HALF_EXTENT,
  };
}

/** Recursively dispose geometry/material for a mesh or group of meshes. */
function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) {
        for (const material of child.material) material.dispose();
      } else {
        child.material?.dispose();
      }
    }
  });
}

export class GameRuntime {
  public readonly canvas: HTMLCanvasElement;

  /** Minimap ("field sketch") — the UI layer appends this where it wants. */
  public readonly minimapCanvas: HTMLCanvasElement;

  /** World survey overlay — toggled with M, display managed here. */
  public readonly worldMapCanvas: HTMLCanvasElement;

  /** WNCORE ambient broadcast ticker — the UI layer appends this. */
  public readonly broadcastElement: HTMLDivElement;

  /** Fired once when the drifter extracts at the entry point (E in range). */
  public onRunComplete: (() => void) | null = null;

  /** Fired when the drifter dies — caller shows death screen. */
  public onRunFail: ((cause: string) => void) | null = null;

  /** Optional audio — pass from AppShell for expedition sounds. */
  public audio: DrifterAudio | null = null;

  private readonly engine: GameplayEngine;
  private readonly zone: Zone;
  private readonly renderer: IsometricRenderer;
  private readonly sky: SkySystem;
  private readonly cinematicCameraController: CinematicCamera;
  /** When true, tick() skips input/movement/combat/HUD updates and only
   *  drives the cinematic camera + sky/render — used for briefing flythroughs.
   *  Defaults false so existing gameplay behavior is unaffected unless
   *  enterCinematic() is explicitly called. */
  private cinematicMode = false;
  private readonly heldKeys = new Set<string>();
  private readonly minimapCtx: CanvasRenderingContext2D;
  private readonly worldMapCtx: CanvasRenderingContext2D;

  // ── Mobile / touch ──────────────────────────────────────────────────────────
  /** Virtual joystick container element. */
  private joystickEl: HTMLDivElement | null = null;
  /** Joystick thumb element. */
  private joystickThumb: HTMLDivElement | null = null;
  /** Action buttons bar (Map, Extract). */
  private actionBarEl: HTMLDivElement | null = null;
  /** Active joystick touch identifier. */
  private joystickTouchId: number | null = null;
  /** Joystick origin (center) in page coordinates. */
  private joystickOrigin: { x: number; y: number } = { x: 0, y: 0 };
  /** Current normalised joystick direction (-1…1 per axis). */
  private touchInput: { x: number; y: number } = { x: 0, y: 0 };

  private animationFrame: number | null = null;
  private lastTimestamp = performance.now();
  private drifterMesh: THREE.Mesh | null = null;
  private drifterAnimator: SpriteAnimator | null = null;
  private worldMapVisible = false;
  private extractionPoint: { x: number; y: number };
  private extractionNearby = false;
  private extractionMarker: THREE.Mesh | null = null;
  private runCompleted = false;
  private elapsed = 0;
  private broadcastTimer = 4;
  private lastBroadcastIndex = -1;

  /** Static scene furniture (ground, grid, markers, drifter) — never zone-evicted. */
  private staticObjects: THREE.Object3D[] = [];

  /** Zone-tagged scene objects (buildings), keyed by zoneId → objects, so
   *  ZoneStreamer.onUnload can cleanly strip exactly one zone's meshes. */
  private zoneObjects: Map<ZoneID, THREE.Object3D[]> = new Map();

  /** Zones currently known to the streamer window — feeds the world survey map. */
  private knownZones: Map<ZoneID, { zone: Zone; isCenter: boolean }> = new Map();

  /** Husk meshes keyed by HuskEntity.id — persistent across frames, repositioned
   *  in place each tick rather than rebuilt. */
  private huskMeshes: Map<string, THREE.Mesh> = new Map();
  private huskAnimators: Map<string, SpriteAnimator> = new Map();

  // ── Item / goal system ────────────────────────────────────────────────────
  /** Items in this zone, cloned from zone.items so we can splice picked-up ones. */
  private zoneItems: Item[] = [];
  /** Item meshes keyed by item id. */
  private itemMeshes: Map<string, THREE.Mesh> = new Map();
  /** How many items the drifter has cataloged this run. */
  private catalogCount = 0;
  /** Whether goal is complete (all catalogs done). */
  private goalComplete = false;
  /** HUD element for goal/health status — updated in tick. */
  private hudGoalEl: HTMLDivElement | null = null;
  /** Whether drifter is dead (stops the run). */
  private drifterDead = false;
  /** Footstep timer accumulator. */
  private footstepTimer = 0;

  /** Max dimension used for world→scene coordinate mapping. Recomputed whenever
   *  the center zone changes (onZoneLoad with isCenter=true). */
  private maxDimension: number;

  constructor(engine: GameplayEngine, zone: Zone) {
    this.engine = engine;
    this.zone = zone;
    this.maxDimension = Math.max(zone.size.width, zone.size.height, 24);

    const hqRaw = zone.hqEntrance;
    this.extractionPoint = hqRaw
      ? { x: hqRaw.position.x, y: hqRaw.position.y }
      : { x: zone.size.width * 0.5, y: zone.size.height * 0.82 };

    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.imageRendering = 'pixelated';

    this.minimapCanvas = document.createElement('canvas');
    this.minimapCanvas.width = MINIMAP_SIZE;
    this.minimapCanvas.height = MINIMAP_SIZE;
    this.minimapCanvas.style.display = 'block';
    this.minimapCanvas.style.width = `${MINIMAP_SIZE}px`;
    this.minimapCanvas.style.height = `${MINIMAP_SIZE}px`;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;

    this.worldMapCanvas = document.createElement('canvas');
    this.worldMapCanvas.width = WORLDMAP_W;
    this.worldMapCanvas.height = WORLDMAP_H;
    Object.assign(this.worldMapCanvas.style, {
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      display: 'none',
      zIndex: '6',
      border: '1px solid rgba(160,190,220,0.3)',
      background: 'rgba(4,7,12,0.94)',
      pointerEvents: 'none',
    });
    this.worldMapCtx = this.worldMapCanvas.getContext('2d')!;

    this.broadcastElement = document.createElement('div');
    Object.assign(this.broadcastElement.style, {
      position: 'absolute',
      left: '24px',
      bottom: '24px',
      maxWidth: 'min(460px, 44vw)',
      padding: '10px 14px',
      background: 'rgba(4,8,15,0.7)',
      border: '1px solid rgba(255,255,255,0.1)',
      backdropFilter: 'blur(8px)',
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '0.66rem',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'rgba(170,190,210,0.85)',
      lineHeight: '1.7',
      pointerEvents: 'none',
      zIndex: '3',
      transition: 'color 0.4s ease, border-color 0.4s ease',
    });
    this.broadcastElement.innerHTML = '<span style="opacity:0.55;">WNCORE RELAY FEED</span><br>tuning…';

    this.renderer = new IsometricRenderer({
      canvas: this.canvas,
      viewSize: 14,
      cameraDistance: 30,
      pixelPipeline: { internalWidth: 384, internalHeight: 216 },
    });

    this.sky = new SkySystem({
      textureWidth: 512,
      textureHeight: 512,
      zoneSeed: this.zone.seed,
    });

    this.cinematicCameraController = new CinematicCamera(this.renderer.cinematicCamera);
  }

  public async start(): Promise<void> {
    this.sky.init();
    this.renderer.attachSky(this.sky);
    this.sky.applyZone(this.zone);
    this.renderer.syncSky();

    this.buildStaticScene();

    // Build buildings for the initial zone directly — ZoneStreamer uses its
    // own WorldGenerator (different seed) so its onLoad zones won't match
    // this.zone. Populate the starting zone's scene objects here instead.
    this.onZoneLoad(this.zone, true);

    // Drifter sprite — real 8-direction PNG set from disk
    // (assets/characters/drifter/base/north.png ... north-west.png).
    try {
      this.drifterAnimator = new SpriteAnimator({
        framesPerDirection: 1,
        animationFps: 8,
        horizontalLayout: false,
      });
      const drifterMesh = await this.drifterAnimator.initializeDirectional('./assets/characters/drifter/base', 0.7, 1.3);
      drifterMesh.userData.yOffset = 0.65;
      this.renderer.scene.add(drifterMesh);
      this.drifterMesh = drifterMesh;
      this.staticObjects.push(drifterMesh);
    } catch (err) {
      console.warn('Failed to load Drifter sprite, using fallback:', err);
      const fallback = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.9, 0.45),
        new THREE.MeshStandardMaterial({ color: 0x8fd1ff, emissive: 0x17344d, emissiveIntensity: 0.4 })
      );
      fallback.position.set(0, 0.45, 0);
      fallback.userData.yOffset = 0.45;
      this.renderer.scene.add(fallback);
      this.drifterMesh = fallback;
      this.staticObjects.push(fallback);
    }

    this.buildMarkers();
    this.spawnItems();
    await this.spawnHusks();

    // Fires ZoneStreamer.onLoad for the initial 3×3 window synchronously —
    // this.onZoneLoad below is what actually populates zoneObjects now.
    this.engine.zoneStreamer.moveTo({ col: 0, row: 0 });

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);

    // Mobile: build virtual controls on first touch (avoids false-positive on
    // hybrid devices — we only create the UI if the screen is actually touched).
    const onFirstTouch = () => {
      this.buildMobileControls();
      window.removeEventListener('touchstart', onFirstTouch);
    };
    window.addEventListener('touchstart', onFirstTouch, { passive: true });

    this.lastTimestamp = performance.now();

    // Fire a second handleResize one frame after start() so if clientWidth
    // was still 0 at AppShell's pre-start call, we correct it on first tick.
    requestAnimationFrame(() => {
      if (this.canvas.clientWidth > 0) {
        this.renderer.handleResize();
      }
    });

    this.animationFrame = window.requestAnimationFrame(this.tick);
  }

  public stop(): void {
    if (this.animationFrame !== null) {
      window.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);

    this.destroyMobileControls();
    this.disposeAll();
    this.renderer.dispose();
  }

  public handleResize(): void {
    this.renderer.handleResize();
  }

  // ── ZoneStreamer callbacks ──────────────────────────────────────────────
  // Wired in by HomeScreen when it constructs GameplayEngine
  // (zoneStreamerCallbacks.onLoad / onUnload). ZoneStreamer calls them
  // directly — synchronously — from moveTo()/flush().

  /** A zone entered the streaming window (or became the new center). */
  public onZoneLoad(zone: Zone, isCenter: boolean): void {
    this.knownZones.set(zone.id, { zone, isCenter });

    if (isCenter) {
      // Re-anchor the coordinate system to the new center zone so buildings/
      // husks/drifter all map consistently onto the visible scene bounds.
      this.maxDimension = Math.max(zone.size.width, zone.size.height, 24);
    }

    // Already built (e.g. re-fired onLoad for an already-loaded zone that
    // just became center) — don't duplicate meshes.
    if (this.zoneObjects.has(zone.id)) return;

    const built: THREE.Object3D[] = [];
    // Buildings are built at raw world-grid scale (building.size is in the
    // same units as zone.size, e.g. up to ~2048) but only ever *positioned*
    // in the compressed ±SCENE_HALF_EXTENT scene space via worldToScene().
    // Without this scale, every building is a many-hundred-unit slab sitting
    // at a tiny coordinate — the camera ends up inside/behind giant geometry,
    // which is the actual cause of the screen reading as black/overfilled
    // regardless of weather. Same normalization factor worldToScene() uses.
    const worldToSceneScale = (SCENE_HALF_EXTENT * 2) / this.maxDimension;
    for (const building of zone.buildings ?? []) {
      const diorama = this.engine.buildingFactory.build(building, zone.id);
      const { x, z } = worldToScene(building.position, this.maxDimension);
      diorama.group.position.set(x, 0, z);
      diorama.group.scale.setScalar(worldToSceneScale);
      diorama.group.userData.zoneId = zone.id;
      this.renderer.scene.add(diorama.group);
      built.push(diorama.group);
    }
    this.zoneObjects.set(zone.id, built);
  }

  /** A zone left the streaming window — strip its meshes, free GPU memory. */
  public onZoneUnload(zoneId: ZoneID): void {
    this.knownZones.delete(zoneId);
    const objects = this.zoneObjects.get(zoneId);
    if (!objects) return;
    for (const object of objects) {
      this.renderer.scene.remove(object);
      disposeObject3D(object);
    }
    this.zoneObjects.delete(zoneId);
  }

  private getInputVector(): { x: number; y: number } {
    let x = this.touchInput.x;
    let y = this.touchInput.y;

    if (this.heldKeys.has('arrowright') || this.heldKeys.has('d')) x += 1;
    if (this.heldKeys.has('arrowleft') || this.heldKeys.has('a')) x -= 1;
    if (this.heldKeys.has('arrowdown') || this.heldKeys.has('s')) y += 1;
    if (this.heldKeys.has('arrowup') || this.heldKeys.has('w')) y -= 1;

    // clamp so combined keyboard + touch never exceeds 1
    const len = Math.sqrt(x * x + y * y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  /** Attach the in-game goal/health HUD element. Called by AppShell after buildPlayHUD. */
  public attachGoalHUD(el: HTMLDivElement): void {
    this.hudGoalEl = el;
    this.updateGoalHUD();
  }

  /** Spawn glowing item pickups from this.zone.items. */
  private spawnItems(): void {
    // Use a shallow copy so we can splice without mutating the zone.
    this.zoneItems = [...(this.zone.items ?? [])];
    for (const item of this.zoneItems) {
      this.spawnItemMesh(item);
    }
  }

  private spawnItemMesh(item: Item): void {
    const { x, z } = worldToScene(item.position, this.maxDimension);
    const geo = new THREE.CylinderGeometry(0.22, 0.22, 0.12, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x54e6a4,
      emissive: 0x2aaa6a,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.92,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.08, z);
    mesh.userData.itemId = item.id;
    this.renderer.scene.add(mesh);
    this.itemMeshes.set(item.id, mesh);
    // Add a small floating ring above
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.025, 6, 18),
      new THREE.MeshBasicMaterial({ color: 0x54e6a4, transparent: true, opacity: 0.45 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.22, z);
    ring.userData.itemRing = true;
    this.renderer.scene.add(ring);
    this.staticObjects.push(ring); // rings disposed with static scene
    this.itemMeshes.set(item.id + '_ring', ring);
  }

  /** Try to pick up any item within PICKUP_RADIUS of the drifter. */
  private tryPickupNearby(): void {
    if (this.drifterDead || this.runCompleted) return;
    const dp = this.engine.drifter.position;
    for (let i = this.zoneItems.length - 1; i >= 0; i--) {
      const item = this.zoneItems[i];
      const dx = dp.x - item.position.x;
      const dy = dp.y - item.position.y;
      if (Math.sqrt(dx * dx + dy * dy) <= PICKUP_RADIUS) {
        // Pick up
        this.zoneItems.splice(i, 1);
        // Remove meshes
        const mesh = this.itemMeshes.get(item.id);
        if (mesh) { this.renderer.scene.remove(mesh); disposeObject3D(mesh); this.itemMeshes.delete(item.id); }
        const ring = this.itemMeshes.get(item.id + '_ring');
        if (ring) { this.renderer.scene.remove(ring); disposeObject3D(ring); this.itemMeshes.delete(item.id + '_ring'); }

        // Catalog it
        this.catalogCount++;
        this.audio?.playPickup();

        const wasGoalDone = this.goalComplete;
        if (this.catalogCount >= CATALOG_GOAL && !this.goalComplete) {
          this.goalComplete = true;
          this.audio?.playGoalComplete();
        } else if (!wasGoalDone) {
          this.audio?.playGoalProgress();
        }

        this.updateGoalHUD();
        break; // one at a time
      }
    }
  }

  /** Pulse item meshes and handle husk combat damage. */
  private updateCombatAndItems(deltaSeconds: number): void {
    if (this.drifterDead) return;

    // Pulse items
    for (const [id, mesh] of this.itemMeshes) {
      if (!id.endsWith('_ring')) {
        const m = mesh.material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = 0.5 + Math.sin(this.elapsed * 3.2 + mesh.position.x) * 0.35;
      }
    }

    // Combat: husks in ATTACKING state damage the drifter
    const husks = this.engine.huskSystem.getAllHusks();
    let underAttack = false;
    for (const husk of husks) {
      if (husk.state === HuskState.ATTACKING) {
        const dp = this.engine.drifter.position;
        const dx = husk.position.x - dp.x;
        const dy = husk.position.y - dp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Attack range in world units — within ~3% of zone width
        if (dist <= this.maxDimension * 0.06) {
          underAttack = true;
          this.engine.drifter.health = Math.max(0, this.engine.drifter.health - HUSK_ATTACK_DPS * deltaSeconds);
          if (this.engine.drifter.health <= 0) {
            this.killDrifter();
            return;
          }
        }
      }
    }

    // Play hurt sound on first frame of being attacked (debounced)
    if (underAttack && !this._wasUnderAttack) {
      this.audio?.playHurt();
    }
    this._wasUnderAttack = underAttack;
    this.updateGoalHUD();
  }

  private _wasUnderAttack = false;

  private killDrifter(): void {
    if (this.drifterDead) return;
    this.drifterDead = true;
    this.audio?.playDeath();
    this.engine.failRun('Drifter killed by husk');
    if (this.onRunFail) this.onRunFail('SIGNAL LOST. DRIFTER GONE.');
  }

  private updateGoalHUD(): void {
    if (!this.hudGoalEl) return;
    const hp = Math.max(0, Math.round(this.engine.drifter.health));
    const hpColor = hp > 60 ? '#54e6a4' : hp > 30 ? '#f0c060' : '#ff5a4a';
    const goalText = this.goalComplete
      ? '<span style="color:#54e6a4">CATALOGING COMPLETE · EXTRACT NOW</span>'
      : `CATALOG ${this.catalogCount} / ${CATALOG_GOAL} ITEMS &nbsp;<span style="color:rgba(180,200,220,0.45)">[F TO PICK UP]</span>`;
    this.hudGoalEl.innerHTML = `
      <div style="font-family:'Share Tech Mono',monospace;font-size:0.62rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(120,150,180,0.6);margin-bottom:4px;">FIELD OBJECTIVE</div>
      <div style="font-family:'Share Tech Mono',monospace;font-size:0.72rem;letter-spacing:0.1em;color:rgba(200,220,240,0.85);line-height:1.6;">${goalText}</div>
      <div style="margin-top:6px;font-family:'Share Tech Mono',monospace;font-size:0.62rem;letter-spacing:0.14em;text-transform:uppercase;">
        <span style="color:rgba(120,150,180,0.6);">VITALS </span>
        <span style="color:${hpColor};font-size:0.78rem;">${hp}%</span>
        <span style="color:rgba(120,150,180,0.4);margin:0 6px;">·</span>
        <span style="color:rgba(120,150,180,0.6);">HEALTH</span>
      </div>
    `;
  }

  /** Ground plane and grid — not zone content, built once. The drifter visual
   *  is created in start() (sprite with geometric fallback), not here. */
  private buildStaticScene(): void {
    this.disposeStatic();

    // MeshBasicMaterial — unlit, always readable regardless of sky/ambient state.
    const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x1e232e });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(24, 24, 24, 24), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    this.renderer.scene.add(ground);
    this.staticObjects.push(ground);

    // Real ground tile from assets, picked per zone type. Loaded async —
    // the flat fallback color above stays visible until it arrives.
    const tileName = ZONE_GROUND_TILE[this.zone.type] ?? 'dirt_a';
    new THREE.TextureLoader().load(
      `./assets/tiles/ground_sliced/${tileName}.png`,
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(12, 12);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        groundMaterial.map = texture;
        groundMaterial.needsUpdate = true;
      },
      undefined,
      () => { /* keep fallback */ }
    );

    const grid = new THREE.GridHelper(24, 24, 0x2f3948, 0x161c24);
    grid.position.y = 0.01;
    this.renderer.scene.add(grid);
    this.staticObjects.push(grid);
  }

  /** Entry point ring at spawn + extraction pad/beam. Green = the way back
   *  to the relay; blue ring = where the drifter stepped into the zone. */
  private buildMarkers(): void {
    const ext = worldToScene(this.extractionPoint, this.maxDimension);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.06, 14),
      new THREE.MeshStandardMaterial({ color: 0x2fbf7a, emissive: 0x1d8a55, emissiveIntensity: 0.7, transparent: true, opacity: 0.95 })
    );
    pad.position.set(ext.x, 0.05, ext.z);
    this.renderer.scene.add(pad);
    this.staticObjects.push(pad);
    this.extractionMarker = pad;

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 2.6, 8),
      new THREE.MeshBasicMaterial({ color: 0x54e6a4, transparent: true, opacity: 0.22, fog: false })
    );
    beam.position.set(ext.x, 1.35, ext.z);
    this.renderer.scene.add(beam);
    this.staticObjects.push(beam);

    const spawn = worldToScene(this.engine.drifter.position, this.maxDimension);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.03, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0x8fd1ff, transparent: true, opacity: 0.5, fog: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(spawn.x, 0.03, spawn.z);
    this.renderer.scene.add(ring);
    this.staticObjects.push(ring);
  }

  private async spawnHusks(): Promise<void> {
    const husks = this.engine.huskSystem.getAllHusks();
    await Promise.all(husks.map((husk) => this.createHuskVisual(husk)));
  }

  /** Build the visual for one husk: real isometric sprite set when the type
   *  has assets on disk, color-coded cone fallback otherwise. */
  private async createHuskVisual(husk: HuskEntity): Promise<void> {
    if (this.huskMeshes.has(husk.id)) return;

    const { x, z } = worldToScene(husk.position, this.maxDimension);
    const folders = HUSK_SPRITE_FOLDERS[husk.type];

    if (folders && folders.length > 0) {
      // Deterministic variant pick (e.g. jawie bulky/slim) from the husk id.
      let hash = 0;
      for (let i = 0; i < husk.id.length; i += 1) hash = (hash * 31 + husk.id.charCodeAt(i)) | 0;
      const folder = folders[Math.abs(hash) % folders.length];
      try {
        const animator = new SpriteAnimator({
          framesPerDirection: 1,
          animationFps: 6,
          horizontalLayout: false,
        });
        const mesh = await animator.initializeDirectional(`./assets/characters/husks/isometric/${folder}`, 0.75, 1.1);
        mesh.userData.huskId = husk.id;
        mesh.userData.yOffset = 0.55;
        mesh.position.set(x, 0.55, z);
        this.renderer.scene.add(mesh);
        this.huskMeshes.set(husk.id, mesh);
        this.huskAnimators.set(husk.id, animator);
        return;
      } catch {
        // fall through to the geometric fallback below
      }
    }

    const color = HUSK_COLOR[husk.type] ?? HUSK_COLOR_DEFAULT;
    const mesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 0.85, 6),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.15 })
    );
    mesh.userData.huskId = husk.id;
    mesh.userData.yOffset = 0.42;
    mesh.position.set(x, 0.42, z);
    this.renderer.scene.add(mesh);
    this.huskMeshes.set(husk.id, mesh);
  }

  private _huskAttackingSet: Set<string> = new Set();

  private updateHuskMeshes(deltaSeconds: number): void {
    const husks = this.engine.huskSystem.getAllHusks();
    const seen = new Set<string>();
    for (const husk of husks) {
      seen.add(husk.id);
      const mesh = this.huskMeshes.get(husk.id);
      if (!mesh) {
        void this.createHuskVisual(husk);
        continue;
      }

      const { x, z } = worldToScene(husk.position, this.maxDimension);
      mesh.position.set(x, (mesh.userData.yOffset as number) ?? 0.42, z);
      this.applyHuskStateTint(mesh, husk);

      // Play aggro sound once when husk first enters ATTACKING
      if (husk.state === HuskState.ATTACKING && !this._huskAttackingSet.has(husk.id)) {
        this._huskAttackingSet.add(husk.id);
        this.audio?.playHuskAggro();
      } else if (husk.state !== HuskState.ATTACKING) {
        this._huskAttackingSet.delete(husk.id);
      }

      const animator = this.huskAnimators.get(husk.id);
      if (animator) {
        const huskVelocity = (husk as any).velocity || { x: 0, y: 0 };
        const direction = vectorToDirection(huskVelocity.x, huskVelocity.y);
        animator.update(deltaSeconds, direction);
      }
    }
    for (const [id, mesh] of this.huskMeshes) {
      if (!seen.has(id)) {
        this.renderer.scene.remove(mesh);
        disposeObject3D(mesh);
        this.huskMeshes.delete(id);
        this._huskAttackingSet.delete(id);

        const animator = this.huskAnimators.get(id);
        if (animator) {
          animator.dispose();
          this.huskAnimators.delete(id);
        }
      }
    }
  }

  private applyHuskStateTint(mesh: THREE.Mesh, husk: HuskEntity): void {
    // Non-patrol states all read as "hot" — brighter/warmer. No state names
    // leaked into visuals or text (survivor POV only).
    const hot = husk.state !== 'PATROL' && husk.state !== 'LOST';
    const material = mesh.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
    if ((material as THREE.MeshStandardMaterial).emissive !== undefined) {
      (material as THREE.MeshStandardMaterial).emissiveIntensity = hot ? 0.6 : 0.15;
    } else {
      (material as THREE.MeshBasicMaterial).color.setHex(hot ? 0xffc4b4 : 0xffffff);
    }
  }

  // ── Broadcast feed ────────────────────────────────────────────────────

  private updateBroadcast(deltaSeconds: number): void {
    this.broadcastTimer -= deltaSeconds;
    if (this.broadcastTimer > 0) return;

    const whisper = Math.random() < 0.12;
    const pool = whisper ? WHISPER_LINES : BROADCAST_LINES;
    let index = Math.floor(Math.random() * pool.length);
    if (!whisper && index === this.lastBroadcastIndex) index = (index + 1) % pool.length;
    if (!whisper) this.lastBroadcastIndex = index;
    const line = pool[index];

    if (whisper) {
      this.broadcastTimer = 5;
      this.broadcastElement.style.color = 'rgba(255,110,100,0.92)';
      this.broadcastElement.style.borderColor = 'rgba(255,80,70,0.35)';
      this.broadcastElement.innerHTML = `<span style="opacity:0.55;">&gt;&gt; SIGNAL INTRUSION</span><br>${line}`;
    } else {
      const sky = String(this.zone.wrongnessState ?? 'UNKNOWN').replace(/_/g, ' ');
      this.broadcastTimer = 16;
      this.broadcastElement.style.color = 'rgba(170,190,210,0.85)';
      this.broadcastElement.style.borderColor = 'rgba(255,255,255,0.1)';
      this.broadcastElement.innerHTML = `<span style="opacity:0.55;">WNCORE RELAY FEED · SKY ${sky}</span><br>${line}`;
    }
  }

  // ── Minimap + world survey ────────────────────────────────────────────

  private drawMinimap(): void {
    const ctx = this.minimapCtx;
    const pad = 10;
    const scale = (MINIMAP_SIZE - pad * 2) / this.maxDimension;
    const px = (w: number) => pad + w * scale;

    ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
    ctx.fillStyle = 'rgba(6,10,16,0.92)';
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    ctx.strokeStyle = 'rgba(140,170,200,0.35)';
    ctx.strokeRect(pad, pad, this.zone.size.width * scale, this.zone.size.height * scale);

    ctx.fillStyle = 'rgba(120,150,180,0.4)';
    for (const b of this.zone.buildings ?? []) {
      ctx.fillRect(px(b.position.x), px(b.position.y), Math.max(2, b.size.width * scale), Math.max(2, b.size.height * scale));
    }

    ctx.fillStyle = '#39d98a';
    ctx.beginPath();
    ctx.arc(px(this.extractionPoint.x), px(this.extractionPoint.y), 3.5, 0, Math.PI * 2);
    ctx.fill();

    for (const husk of this.engine.huskSystem.getAllHusks()) {
      const hot = husk.state !== 'PATROL' && husk.state !== 'LOST';
      ctx.fillStyle = hot ? '#ff5a4a' : 'rgba(180,120,120,0.5)';
      ctx.beginPath();
      ctx.arc(px(husk.position.x), px(husk.position.y), hot ? 3 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    const dp = this.engine.drifter.position;
    ctx.fillStyle = '#e8f4ff';
    ctx.beginPath();
    ctx.arc(px(dp.x), px(dp.y), 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,244,255,0.5)';
    ctx.beginPath();
    ctx.arc(px(dp.x), px(dp.y), 5.5, 0, Math.PI * 2);
    ctx.stroke();

    if (this.extractionNearby) {
      ctx.fillStyle = '#39d98a';
      ctx.font = "9px 'Share Tech Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('EXTRACTION IN RANGE - PRESS E', MINIMAP_SIZE / 2, 12);
      ctx.textAlign = 'left';
    }
  }

  private drawWorldMap(): void {
    const ctx = this.worldMapCtx;
    ctx.clearRect(0, 0, WORLDMAP_W, WORLDMAP_H);
    ctx.fillStyle = 'rgba(4,7,12,0.96)';
    ctx.fillRect(0, 0, WORLDMAP_W, WORLDMAP_H);
    ctx.strokeStyle = 'rgba(160,190,220,0.28)';
    ctx.strokeRect(0.5, 0.5, WORLDMAP_W - 1, WORLDMAP_H - 1);

    ctx.fillStyle = 'rgba(210,228,244,0.9)';
    ctx.font = "11px 'Share Tech Mono', monospace";
    ctx.textAlign = 'left';
    ctx.fillText('WNCORE REGIONAL SURVEY · KNOWN ZONES', 14, 22);

    const zones = Array.from(this.knownZones.values());
    let y = 48;
    for (const info of zones.slice(0, 7)) {
      const current = info.zone.id === this.zone.id;
      ctx.fillStyle = current ? '#54e6a4' : 'rgba(190,208,224,0.75)';
      ctx.fillText(`${current ? '>' : ' '} ${info.zone.name}`, 14, y);
      ctx.fillStyle = 'rgba(150,168,186,0.6)';
      ctx.fillText(`   ${String(info.zone.type).replace(/_/g, ' ')} · SKY ${String(info.zone.wrongnessState ?? 'UNKNOWN')}`, 14, y + 13);
      y += 34;
    }

    if (zones.length > 0) {
      const xs = zones.map((z) => z.zone.position?.x ?? 0);
      const ys = zones.map((z) => z.zone.position?.y ?? 0);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const plotX = WORLDMAP_W - 150;
      const plotY = 44;
      const plotSize = 120;
      ctx.strokeStyle = 'rgba(160,190,220,0.2)';
      ctx.strokeRect(plotX, plotY, plotSize, plotSize);
      for (const info of zones) {
        const nx = maxX === minX ? 0.5 : ((info.zone.position?.x ?? 0) - minX) / (maxX - minX);
        const ny = maxY === minY ? 0.5 : ((info.zone.position?.y ?? 0) - minY) / (maxY - minY);
        const cx = plotX + 10 + nx * (plotSize - 20);
        const cy = plotY + 10 + ny * (plotSize - 20);
        const current = info.zone.id === this.zone.id;
        ctx.fillStyle = current ? '#54e6a4' : 'rgba(190,208,224,0.6)';
        ctx.beginPath();
        ctx.arc(cx, cy, current ? 4 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = 'rgba(150,168,186,0.55)';
    ctx.fillText('M · CLOSE SURVEY', 14, WORLDMAP_H - 14);
  }

  private toggleWorldMap(): void {
    this.worldMapVisible = !this.worldMapVisible;
    this.worldMapCanvas.style.display = this.worldMapVisible ? 'block' : 'none';
    if (this.worldMapVisible) this.drawWorldMap();
  }

  private tryExtract(): void {
    if (!this.extractionNearby || this.runCompleted) return;
    this.runCompleted = true;
    if (this.onRunComplete) this.onRunComplete();
  }

  private disposeStatic(): void {
    for (const object of this.staticObjects) {
      this.renderer.scene.remove(object);
      disposeObject3D(object);
    }
    this.staticObjects.length = 0;
    this.drifterMesh = null;
    this.extractionMarker = null;
  }

  private disposeAll(): void {
    this.disposeStatic();
    for (const zoneId of Array.from(this.zoneObjects.keys())) {
      this.onZoneUnload(zoneId);
    }
    this.knownZones.clear();

    if (this.drifterAnimator) {
      this.drifterAnimator.dispose();
      this.drifterAnimator = null;
    }

    for (const [id, mesh] of this.huskMeshes) {
      this.renderer.scene.remove(mesh);
      disposeObject3D(mesh);
      this.huskMeshes.delete(id);

      const animator = this.huskAnimators.get(id);
      if (animator) {
        animator.dispose();
        this.huskAnimators.delete(id);
      }
    }

    this.worldMapVisible = false;
    this.worldMapCanvas.style.display = 'none';
  }

  /**
   * Switch to a free-flying perspective view of the already-built scene and
   * suspend gameplay updates (movement, combat, HUD). Intended for the
   * briefing screen's "drop preview" — the zone is already generated/loaded
   * by this point (start() must have run first), so this just changes what's
   * drawn, not what exists. Defaults to a slow orbit if no keyframes given.
   */
  public enterCinematic(orbitOptions?: OrbitOptions): void {
    this.cinematicMode = true;
    this.renderer.useCinematicCamera();
    this.cinematicCameraController.orbit({
      radius: this.maxDimension > 0 ? Math.min(18, this.maxDimension * 0.02) : 12,
      height: 7,
      speedRadPerSec: 0.06,
      ...orbitOptions,
    });
  }

  /** Play a one-shot scripted flythrough instead of the default orbit —
   *  e.g. a scripted "drop-in" pan across the zone before the briefing
   *  Confirm button appears. Falls back to orbit() behavior once finished
   *  unless exitCinematic()/a new call supersedes it. */
  public playCinematicPath(keyframes: Parameters<CinematicCamera['flyPath']>[0], onComplete?: () => void): void {
    this.cinematicMode = true;
    this.renderer.useCinematicCamera();
    this.cinematicCameraController.flyPath(keyframes, onComplete);
  }

  /** Return to the fixed iso gameplay camera and resume normal ticking
   *  (input, movement, combat, HUD). Call when the player confirms
   *  deployment from the briefing screen. */
  public exitCinematic(): void {
    this.cinematicMode = false;
    this.cinematicCameraController.stop();
    this.renderer.useIsoCamera();
  }

  public isCinematicActive(): boolean {
    return this.cinematicMode;
  }

  private tick = (timestamp: number): void => {
    const deltaSeconds = Math.min(0.05, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;
    this.elapsed += deltaSeconds;

    if (this.drifterDead) {
      this.animationFrame = window.requestAnimationFrame(this.tick);
      return;
    }

    if (this.cinematicMode) {
      this.cinematicCameraController.update(deltaSeconds);
    } else {
      const input = this.getInputVector();
      this.engine.update(deltaSeconds, input, []);

      // Footstep sounds while moving
      const isMoving = Math.abs(input.x) + Math.abs(input.y) > 0.01;
      if (isMoving) {
        this.footstepTimer += deltaSeconds;
        if (this.footstepTimer >= FOOTSTEP_INTERVAL) {
          this.footstepTimer = 0;
          this.audio?.playFootstep();
        }
      } else {
        this.footstepTimer = 0;
      }

      // Update Drifter position and animation
      const drifterPosition = this.engine.drifter.position;
      if (this.drifterMesh && drifterPosition) {
        const { x, z } = worldToScene(drifterPosition, this.maxDimension);
        this.drifterMesh.position.set(x, (this.drifterMesh.userData.yOffset as number) ?? 0.45, z);

        if (this.drifterAnimator) {
          const direction = vectorToDirection(input.x, input.y);
          this.drifterAnimator.update(deltaSeconds, direction);
        }
      }

      // Extraction proximity + marker pulse
      if (drifterPosition) {
        const dx = drifterPosition.x - this.extractionPoint.x;
        const dy = drifterPosition.y - this.extractionPoint.y;
        const threshold = Math.max(1.5, this.maxDimension * 0.08);
        this.extractionNearby = Math.sqrt(dx * dx + dy * dy) <= threshold;
      }
      if (this.extractionMarker) {
        const m = this.extractionMarker.material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = this.extractionNearby
          ? 1.1 + Math.sin(this.elapsed * 6) * 0.3
          : 0.55 + Math.sin(this.elapsed * 2.4) * 0.2;
      }

      this.updateHuskMeshes(deltaSeconds);
      this.updateCombatAndItems(deltaSeconds);
      this.updateBroadcast(deltaSeconds);

      this.drawMinimap();
      if (this.worldMapVisible) this.drawWorldMap();
    }

    this.sky.update(deltaSeconds, {
      timeOfDay: this.zone.timeOfDay,
      weatherState: this.zone.weatherState,
      fogIntensity: this.zone.fogIntensity,
      wrongnessState: this.zone.wrongnessState,
      zoneSeed: this.zone.seed,
    });

    this.renderer.syncSky(deltaSeconds);
    this.renderer.render();

    this.animationFrame = window.requestAnimationFrame(this.tick);
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    // Allow Escape to return to the main menu (if HomeScreen is present on window)
    if (event.key === 'Escape') {
      try {
        const app = (window as any).__DRIFTER_APP as { showMenu?: () => void } | undefined;
        if (app && typeof app.showMenu === 'function') {
          app.showMenu();
        }
      } catch (e) {
        // ignore
      }
      return;
    }

    const key = event.key.toLowerCase();
    if (key === 'm') {
      this.toggleWorldMap();
      return;
    }
    if (key === 'e') {
      this.tryExtract();
      return;
    }
    if (key === 'f') {
      this.tryPickupNearby();
      return;
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(event.key)) {
      event.preventDefault();
    }
    this.heldKeys.add(key);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.heldKeys.delete(event.key.toLowerCase());
  };

  private onResize = (): void => {
    this.handleResize();
  };

  // ── Mobile controls ─────────────────────────────────────────────────────────

  private buildMobileControls(): void {
    if (this.joystickEl) return; // already built

    const JOYSTICK_R = 52;
    const THUMB_R = 24;

    // World-map canvas: accept taps to dismiss
    this.worldMapCanvas.style.pointerEvents = 'auto';
    this.worldMapCanvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.toggleWorldMap();
    }, { passive: false });

    // ── Joystick ──────────────────────────────────────────────────────────────
    const joystick = document.createElement('div');
    joystick.style.cssText = `
      position:fixed;
      left:24px;
      bottom:32px;
      width:${JOYSTICK_R * 2}px;
      height:${JOYSTICK_R * 2}px;
      border-radius:50%;
      background:rgba(255,255,255,0.07);
      border:1.5px solid rgba(255,255,255,0.18);
      touch-action:none;
      z-index:20;
      user-select:none;
      -webkit-user-select:none;
    `;

    const thumb = document.createElement('div');
    thumb.style.cssText = `
      position:absolute;
      left:50%;top:50%;
      width:${THUMB_R * 2}px;
      height:${THUMB_R * 2}px;
      margin-left:-${THUMB_R}px;
      margin-top:-${THUMB_R}px;
      border-radius:50%;
      background:rgba(84,230,164,0.55);
      border:1.5px solid rgba(84,230,164,0.85);
      pointer-events:none;
      transition:transform 0.05s ease;
    `;
    joystick.appendChild(thumb);

    joystick.addEventListener('touchstart', this.onJoystickStart, { passive: false });
    joystick.addEventListener('touchmove', this.onJoystickMove, { passive: false });
    joystick.addEventListener('touchend', this.onJoystickEnd, { passive: false });
    joystick.addEventListener('touchcancel', this.onJoystickEnd, { passive: false });

    // ── Action bar ────────────────────────────────────────────────────────────
    const bar = document.createElement('div');
    bar.style.cssText = `
      position:fixed;
      right:16px;
      bottom:32px;
      display:flex;
      flex-direction:column;
      gap:10px;
      z-index:20;
      user-select:none;
      -webkit-user-select:none;
    `;

    const btnMap = this.makeMobileBtn('MAP', () => this.toggleWorldMap());
    const btnExtract = this.makeMobileBtn('EXTRACT', () => this.tryExtract());

    bar.appendChild(btnMap);
    bar.appendChild(btnExtract);

    // Both are position:fixed so they anchor to the viewport regardless of DOM parent.
    document.body.appendChild(joystick);
    document.body.appendChild(bar);

    this.joystickEl = joystick;
    this.joystickThumb = thumb;
    this.actionBarEl = bar;
  }

  private makeMobileBtn(label: string, action: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      display:block;
      padding:10px 18px;
      background:rgba(4,8,15,0.75);
      border:1.5px solid rgba(255,255,255,0.18);
      border-radius:4px;
      color:rgba(210,228,244,0.9);
      font-family:'Share Tech Mono',monospace;
      font-size:0.62rem;
      letter-spacing:0.18em;
      text-transform:uppercase;
      cursor:pointer;
      touch-action:manipulation;
      -webkit-tap-highlight-color:transparent;
    `;
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); action(); }, { passive: false });
    return btn;
  }

  private destroyMobileControls(): void {
    this.joystickEl?.removeEventListener('touchstart', this.onJoystickStart);
    this.joystickEl?.removeEventListener('touchmove', this.onJoystickMove);
    this.joystickEl?.removeEventListener('touchend', this.onJoystickEnd);
    this.joystickEl?.removeEventListener('touchcancel', this.onJoystickEnd);
    this.joystickEl?.remove();
    this.actionBarEl?.remove();
    this.joystickEl = null;
    this.joystickThumb = null;
    this.actionBarEl = null;
    this.joystickTouchId = null;
    this.touchInput = { x: 0, y: 0 };
  }

  private onJoystickStart = (e: TouchEvent): void => {
    e.preventDefault();
    if (this.joystickTouchId !== null) return;
    const touch = e.changedTouches[0];
    this.joystickTouchId = touch.identifier;
    const rect = this.joystickEl!.getBoundingClientRect();
    this.joystickOrigin = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    this.updateJoystick(touch);
  };

  private onJoystickMove = (e: TouchEvent): void => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.joystickTouchId) {
        this.updateJoystick(t);
        return;
      }
    }
  };

  private onJoystickEnd = (e: TouchEvent): void => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.joystickTouchId) {
        this.joystickTouchId = null;
        this.touchInput = { x: 0, y: 0 };
        if (this.joystickThumb) {
          this.joystickThumb.style.transform = 'translate(0,0)';
        }
        return;
      }
    }
  };

  private updateJoystick(touch: Touch): void {
    if (!this.joystickEl || !this.joystickThumb) return;
    const DEAD = 6;
    const MAX_R = 44;
    const dx = touch.clientX - this.joystickOrigin.x;
    const dy = touch.clientY - this.joystickOrigin.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const clamped = Math.min(dist, MAX_R);
    const nx = dist > DEAD ? (dx / dist) * (clamped / MAX_R) : 0;
    const ny = dist > DEAD ? (dy / dist) * (clamped / MAX_R) : 0;
    this.touchInput = { x: nx, y: ny };

    const tx = nx * MAX_R;
    const ty = ny * MAX_R;
    this.joystickThumb.style.transform = `translate(${tx}px,${ty}px)`;
  }
}