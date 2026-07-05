/**
 * AtmosphereController
 * Step 2.7 in the rendering build order (... -> DustParticles ->
 * AtmosphereController -> TextureCache/ZoneStreamer).
 *
 * Owns the screen-space "camera lens" layer — vignette, rain-on-glass,
 * chromatic aberration/glitch, Obsedia Rain foreground drips — as plain
 * CSS+SVG DOM overlays sitting as a sibling over the game canvas, per the
 * plan doc's "CSS+SVG screen-space presets" line item. Deliberately NOT
 * Three.js: these are viewport-space effects (they shouldn't move with the
 * camera or get caught up in the isometric scene's lighting/fog), and CSS
 * gives cheap, GPU-composited overlays without spending render-target
 * budget PixelPipeline/GodRayLayer/DustParticles already use.
 *
 * Distinct from SkySystem's WrongnessState handling: SkySystem changes
 * what the WORLD's sky looks like (baked into its texture). This class
 * changes what the PLAYER'S VIEW looks like (vignette/aberration/rain on
 * "the lens" itself) — same source state (WrongnessState/WeatherType/
 * Obsedia Rain), two different visual layers, intentionally separated so
 * either can be tuned without touching the other's bake logic.
 *
 * Usage:
 *   const atmosphere = new AtmosphereController(canvasContainerEl);
 *   // each frame / on zone or state change:
 *   atmosphere.update({ wrongnessState, weatherState, obsediaRain, decayLevel });
 *   // on resize:
 *   atmosphere.handleResize();
 */
import { WrongnessState } from './SkySystem.js';
import type { WeatherType } from '../types.js';
export interface AtmosphereState {
    wrongnessState: WrongnessState;
    weatherState: WeatherType;
    obsediaRainActive: boolean;
    obsediaRainIntensity: number;
    decayLevel: number;
}
export declare class AtmosphereController {
    private container;
    private root;
    private vignetteEl;
    private rainEl;
    private obsediaEl;
    private glitchEl;
    private styleEl;
    private glitchTimer;
    private nextGlitchAt;
    private lastState;
    constructor(container: HTMLElement);
    private injectStyles;
    /**
     * Call on zone/state change AND ideally once per frame (or on a coarser
     * tick — e.g. every 100ms is plenty, this is CSS not a render pass) with
     * deltaTime so the STATIC glitch flicker and rain/obsedia intensity stay
     * alive without needing a separate ticking mechanism of their own.
     */
    update(state: AtmosphereState, deltaTime?: number): void;
    /** Returns the most recently applied state — useful for other systems (e.g. a debug HUD, or HazardSystem checking current atmosphere) to read without re-deriving it. */
    getLastState(): AtmosphereState | null;
    private triggerGlitchPulse;
    /** No-op placeholder for symmetry with other render-system classes' resize hooks — CSS overlay sizes itself via `inset: 0`, nothing to recompute. */
    handleResize(): void;
    dispose(): void;
}
export { WrongnessState };
//# sourceMappingURL=AtmosphereController.d.ts.map