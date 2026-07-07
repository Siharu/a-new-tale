import type { Zone, ZoneID } from '../types.js';
import type { GameplayEngine } from '../gameplay/index.js';
import { CinematicCamera, type OrbitOptions } from '../render/CinematicCamera.js';
import type { DrifterAudio } from './DrifterAudio.js';
export declare class GameRuntime {
    readonly canvas: HTMLCanvasElement;
    /** Minimap ("field sketch") — the UI layer appends this where it wants. */
    readonly minimapCanvas: HTMLCanvasElement;
    /** World survey overlay — toggled with M, display managed here. */
    readonly worldMapCanvas: HTMLCanvasElement;
    /** WNCORE ambient broadcast ticker — the UI layer appends this. */
    readonly broadcastElement: HTMLDivElement;
    /** Fired once when the drifter extracts at the entry point (E in range). */
    onRunComplete: (() => void) | null;
    /** Fired when the drifter dies — caller shows death screen. */
    onRunFail: ((cause: string) => void) | null;
    /** Optional audio — pass from AppShell for expedition sounds. */
    audio: DrifterAudio | null;
    private readonly engine;
    private readonly zone;
    private readonly renderer;
    private readonly sky;
    private readonly cinematicCameraController;
    /** When true, tick() skips input/movement/combat/HUD updates and only
     *  drives the cinematic camera + sky/render — used for briefing flythroughs.
     *  Defaults false so existing gameplay behavior is unaffected unless
     *  enterCinematic() is explicitly called. */
    private cinematicMode;
    private readonly heldKeys;
    private readonly minimapCtx;
    private readonly worldMapCtx;
    /** Virtual joystick container element. */
    private joystickEl;
    /** Joystick thumb element. */
    private joystickThumb;
    /** Action buttons bar (Map, Extract). */
    private actionBarEl;
    /** Active joystick touch identifier. */
    private joystickTouchId;
    /** Joystick origin (center) in page coordinates. */
    private joystickOrigin;
    /** Current normalised joystick direction (-1…1 per axis). */
    private touchInput;
    private animationFrame;
    private lastTimestamp;
    private drifterMesh;
    private drifterAnimator;
    private worldMapVisible;
    private extractionPoint;
    private extractionNearby;
    private extractionMarker;
    private runCompleted;
    private elapsed;
    private broadcastTimer;
    private lastBroadcastIndex;
    /** Static scene furniture (ground, grid, markers, drifter) — never zone-evicted. */
    private staticObjects;
    /** Zone-tagged scene objects (buildings), keyed by zoneId → objects, so
     *  ZoneStreamer.onUnload can cleanly strip exactly one zone's meshes. */
    private zoneObjects;
    /** Zones currently known to the streamer window — feeds the world survey map. */
    private knownZones;
    /** Husk meshes keyed by HuskEntity.id — persistent across frames, repositioned
     *  in place each tick rather than rebuilt. */
    private huskMeshes;
    private huskAnimators;
    /** Items in this zone, cloned from zone.items so we can splice picked-up ones. */
    private zoneItems;
    /** Item meshes keyed by item id. */
    private itemMeshes;
    /** How many items the drifter has cataloged this run. */
    private catalogCount;
    /** Whether goal is complete (all catalogs done). */
    private goalComplete;
    /** HUD element for goal/health status — updated in tick. */
    private hudGoalEl;
    /** Whether drifter is dead (stops the run). */
    private drifterDead;
    /** Footstep timer accumulator. */
    private footstepTimer;
    /** Max dimension used for world→scene coordinate mapping. Recomputed whenever
     *  the center zone changes (onZoneLoad with isCenter=true). */
    private maxDimension;
    constructor(engine: GameplayEngine, zone: Zone);
    start(): Promise<void>;
    stop(): void;
    handleResize(): void;
    /** A zone entered the streaming window (or became the new center). */
    onZoneLoad(zone: Zone, isCenter: boolean): void;
    /** A zone left the streaming window — strip its meshes, free GPU memory. */
    onZoneUnload(zoneId: ZoneID): void;
    private getInputVector;
    /** Attach the in-game goal/health HUD element. Called by AppShell after buildPlayHUD. */
    attachGoalHUD(el: HTMLDivElement): void;
    /** Spawn glowing item pickups from this.zone.items. */
    private spawnItems;
    private spawnItemMesh;
    /** Try to pick up any item within PICKUP_RADIUS of the drifter. */
    private tryPickupNearby;
    /** Pulse item meshes and handle husk combat damage. */
    private updateCombatAndItems;
    private _wasUnderAttack;
    private killDrifter;
    private updateGoalHUD;
    /** Ground plane and grid — not zone content, built once. The drifter visual
     *  is created in start() (sprite with geometric fallback), not here. */
    private buildStaticScene;
    /** Entry point ring at spawn + extraction pad/beam. Green = the way back
     *  to the relay; blue ring = where the drifter stepped into the zone. */
    private buildMarkers;
    private spawnHusks;
    /** Build the visual for one husk: real isometric sprite set when the type
     *  has assets on disk, color-coded cone fallback otherwise. */
    private createHuskVisual;
    private _huskAttackingSet;
    private updateHuskMeshes;
    private applyHuskStateTint;
    private updateBroadcast;
    private drawMinimap;
    private drawWorldMap;
    private toggleWorldMap;
    private tryExtract;
    private disposeStatic;
    private disposeAll;
    /**
     * Switch to a free-flying perspective view of the already-built scene and
     * suspend gameplay updates (movement, combat, HUD). Intended for the
     * briefing screen's "drop preview" — the zone is already generated/loaded
     * by this point (start() must have run first), so this just changes what's
     * drawn, not what exists. Defaults to a slow orbit if no keyframes given.
     */
    enterCinematic(orbitOptions?: OrbitOptions): void;
    /** Play a one-shot scripted flythrough instead of the default orbit —
     *  e.g. a scripted "drop-in" pan across the zone before the briefing
     *  Confirm button appears. Falls back to orbit() behavior once finished
     *  unless exitCinematic()/a new call supersedes it. */
    playCinematicPath(keyframes: Parameters<CinematicCamera['flyPath']>[0], onComplete?: () => void): void;
    /** Return to the fixed iso gameplay camera and resume normal ticking
     *  (input, movement, combat, HUD). Call when the player confirms
     *  deployment from the briefing screen. */
    exitCinematic(): void;
    isCinematicActive(): boolean;
    private tick;
    private onKeyDown;
    private onKeyUp;
    private onResize;
    private buildMobileControls;
    private makeMobileBtn;
    private destroyMobileControls;
    private onJoystickStart;
    private onJoystickMove;
    private onJoystickEnd;
    private updateJoystick;
}
//# sourceMappingURL=GameRuntime.d.ts.map