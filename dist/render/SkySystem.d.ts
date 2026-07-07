/**
 * SkySystem
 * Procedural sky: hand-authored color keyframes (not generated hue cycle),
 * baked from SVG-style canvas drawing -> THREE.CanvasTexture, per the locked
 * SVG-procedural-generation approach.
 *
 * Drives ambient/fog color from a single source of truth (the sky), per
 * the locked architecture decision in DRIFTER_ENGINE_PLAN.md.
 *
 * v2 — reworked around the Cygnus Signal Series lore:
 *   - WrongnessState replaces the old continuous corruptionOverlay slider.
 *     Discrete, hand-authored progression: SUNNY -> BLUE -> GREY -> RAINY ->
 *     STATIC -> UNKNOWN -> STORMY -> DIFFERENT -> ANOTHER_SKY.
 *     STATIC gets an actual glitch/flicker pass, not just a color shift.
 *   - Moon is now a tracked, persistent object (position/phase/anomaly),
 *     independent of the day/night sunMoon glow — it can be visible (faint)
 *     during the day and is a plot anchor (Moon Dome), not just a light.
 *   - Obsedia Rain (black oil rain / Black Rain / Moon Rain / Starfall) is
 *     a distinct overlay effect: random, unpredictable, bleeds the sky dark
 *     and gooey rather than being tied to a WeatherType.
 *   - Stars + procedural clouds folded in as additional baked layers,
 *     seeded per zone so each Drifter's region reads as visually distinct.
 *
 * Tune colors first in sky_preview.html (update it alongside this file —
 * the math should stay identical on both sides), then port changes here.
 */
import * as THREE from 'three';
import { WrongnessState } from '../types.js';
import type { WeatherType, Zone } from '../types.js';
export { WrongnessState };
export declare const WRONGNESS_ORDER: WrongnessState[];
export interface MoonState {
    visible: boolean;
    phase: number;
    anomalyActive: boolean;
}
export interface ObsediaRainState {
    active: boolean;
    intensity: number;
}
export interface SkySystemOptions {
    textureWidth?: number;
    textureHeight?: number;
    grainAmount?: number;
    zoneSeed?: number;
    starCount?: number;
    cloudCount?: number;
}
export interface SkyWorldState {
    timeOfDay?: number;
    weatherState?: WeatherType;
    fogIntensity?: number;
    wrongnessState?: WrongnessState;
    moon?: Partial<MoonState>;
    obsediaRain?: Partial<ObsediaRainState>;
    zoneSeed?: number;
}
export declare class SkySystem {
    timeOfDay: number;
    weatherState: WeatherType;
    wrongnessState: WrongnessState;
    moon: MoonState;
    obsediaRain: ObsediaRainState;
    baseColor: THREE.Color;
    fogColor: THREE.Color;
    private canvas;
    private ctx;
    private texture;
    private grainAmount;
    private lastComputed;
    private dirty;
    private zoneSeed;
    private starCount;
    private cloudCount;
    private stars;
    private clouds;
    private glitchSeedTime;
    private _lastFogIntensity;
    private _directionalLight;
    constructor(options?: SkySystemOptions);
    init(): void;
    /**
     * Convenience wrapper around update() for once WorldGenerator/ZoneStreamer
     * exist — reads timeOfDay/weatherState/fogIntensity/wrongnessState/seed
     * straight off a Zone instead of hand-building a SkyWorldState each time.
     * Moon and Obsedia Rain aren't on Zone yet (they're world/run-level, not
     * per-zone), so pass those separately via update() if needed alongside this.
     */
    applyZone(zone: Zone, deltaTime?: number): void;
    private generateStarsAndClouds;
    /** Call once per frame / on zone change. Cheap no-op if nothing relevant changed. */
    update(deltaTime: number, worldState?: SkyWorldState): void;
    setFogIntensity(value: number): void;
    /** Randomly trigger/stop Obsedia Rain — call from a world-level random-event ticker. */
    triggerObsediaRain(intensity?: number): void;
    stopObsediaRain(): void;
    getAmbientLight(): THREE.Color;
    getDirectionalLight(): THREE.DirectionalLight;
    getTexture(): THREE.CanvasTexture;
    /** Current fog/haze intensity (0–1) — exposed so other render systems (e.g. DustParticles via IsometricRenderer) can read it without duplicating the state SkySystem already tracks. */
    getFogIntensity(): number;
    private computeSky;
    /** Re-renders the gradient + glow + moon + stars + clouds + grain + rain to canvas, flags texture for upload. */
    private bake;
    private drawGlow;
    /** STATIC wrongness: thin horizontal tear bands + RGB-split flicker, randomized per bake. */
    private drawGlitch;
    /** Obsedia Rain: diagonal dark oil streaks + a gooey dark vignette bleeding from the top. */
    private drawObsediaRain;
    private grainCache;
    private applyGrain;
    dispose(): void;
}
//# sourceMappingURL=SkySystem.d.ts.map