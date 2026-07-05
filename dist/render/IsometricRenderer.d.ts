/**
 * IsometricRenderer
 * Owns the fixed-pitch, non-rotating orthographic isometric camera and the
 * main game scene. Delegates resolution/upscale to PixelPipeline, shadow
 * setup to LightingController, and crepuscular rays to GodRayLayer (kept
 * separate per DRIFTER_ENGINE_PLAN.md's class list / rendering deep-dive
 * build order 2.1–2.8) — this class wires them together rather than
 * reimplementing any of their concerns inline.
 *
 * v2 — integrates step 2.4 (LightingController) and 2.5 (GodRayLayer) on
 * top of the v1 M2 scope (empty scene + sky). Both are attached
 * automatically inside attachSky() since they depend on the same
 * directional light SkySystem produces; nothing else changes about how a
 * caller uses this class versus v1 — attachSky()/syncSky()/render() still
 * the only required calls.
 *
 * Camera: classic 2:1 "game isometric" — 45° yaw, ~35.264° pitch (true
 * isometric, matches Octopath/HD-2D convention) rather than an actual 45°
 * pitch, which reads as too steep/top-down for this style. Fixed — no
 * rotation, per the locked DRIFTER lore/build decisions (non-rotating
 * camera was an explicit call in the player sprite system too).
 */
import * as THREE from 'three';
import { PixelPipeline, type PixelPipelineOptions } from './PixelPipeline.js';
import { LightingController, type LightingControllerOptions } from './LightingController.js';
import { GodRayLayer, type GodRayLayerOptions } from './GodRayLayer.js';
import { DustParticles, type DustParticlesOptions } from './DustParticles.js';
import { RainSystem, type RainSystemOptions } from './RainSystem.js';
import { AtmosphereController } from './AtmosphereController.js';
import type { SkySystem } from './SkySystem.js';
export interface IsometricRendererOptions {
    canvas: HTMLCanvasElement;
    viewSize?: number;
    cameraDistance?: number;
    pixelPipeline?: PixelPipelineOptions;
    lighting?: LightingControllerOptions;
    godRays?: GodRayLayerOptions;
    dustParticles?: DustParticlesOptions;
    rainSystem?: RainSystemOptions;
    enableGodRays?: boolean;
    enableDustParticles?: boolean;
    enableAtmosphere?: boolean;
}
export declare class IsometricRenderer {
    readonly scene: THREE.Scene;
    readonly camera: THREE.OrthographicCamera;
    readonly renderer: THREE.WebGLRenderer;
    readonly pixelPipeline: PixelPipeline;
    readonly lightingController: LightingController;
    readonly godRayLayer: GodRayLayer;
    readonly dustParticles: DustParticles;
    readonly rainSystem: RainSystem;
    readonly atmosphereController: AtmosphereController | null;
    private canvas;
    private viewSize;
    private cameraDistance;
    private skyDome;
    private ambientLight;
    private directionalLight;
    private attachedSky;
    private godRaysEnabled;
    private dustEnabled;
    private decayLevel;
    constructor(options: IsometricRendererOptions);
    private buildIsoCamera;
    /**
     * Wires a SkySystem in as the single source of truth for ambient/fog
     * color and the background dome, per the locked architecture decision.
     * Also attaches LightingController (shadow casting on the key light) and
     * exempts the sky dome from GodRayLayer's occlusion pass — without that
     * exemption the dome would block its own light source at the source,
     * defeating the ray effect entirely.
     * Call once after both are constructed, then call syncSky() each frame
     * (or whenever the sky bakes a new texture/light state) to keep them
     * in sync — SkySystem.update() must be called separately beforehand.
     */
    attachSky(sky: SkySystem): void;
    /**
     * Call each frame after sky.update() to push the latest bake into the
     * renderer. deltaTime drives DustParticles' drift animation — pass 0 if
     * called outside a normal per-frame loop (e.g. a one-off debug refresh);
     * dust simply won't visibly drift that frame, nothing else breaks.
     */
    syncSky(deltaTime?: number): void;
    /** Set the current zone's decayLevel (0–1) — drives AtmosphereController's vignette strength. Call on zone change/load; not derived automatically since it's Zone/world-content state, not part of SkySystem's bake inputs. */
    setDecayLevel(value: number): void;
    /**
     * Renders the scene through PixelPipeline (low-res bake), then — if god
     * rays are enabled and a sky/light is attached — runs GodRayLayer's
     * occlusion + radial-blur passes and blits ITS composited output instead
     * of the raw scene texture. Falls back to the plain PixelPipeline blit
     * when god rays are disabled or no directional light exists yet (e.g.
     * attachSky() hasn't been called), so this is always safe to call.
     */
    render(): void;
    /** Toggle god rays at runtime (e.g. quality settings, or auto-disable during HUSK_NEST combat for clarity). */
    setGodRaysEnabled(enabled: boolean): void;
    /** Toggle dust motes at runtime (e.g. disable indoors via Zone/Room type, or during Obsedia Rain where falling streaks replace ambient dust). */
    setDustParticlesEnabled(enabled: boolean): void;
    /** Call on window resize / canvas size change. */
    handleResize(): void;
    dispose(): void;
}
//# sourceMappingURL=IsometricRenderer.d.ts.map