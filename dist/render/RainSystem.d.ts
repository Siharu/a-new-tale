/**
 * RainSystem
 * GPU point-sprite rain for the Drifter's Tale engine.
 *
 * Two distinct modes driven by weather/wrongness state:
 *
 *   REGULAR — ACID_RAIN weatherState or RAINY/STORMY wrongnessState.
 *     Fast-falling angled streaks, blue-grey tinted, moderate count.
 *     Particles are stretched along their fall direction in the vertex
 *     shader by writing a tall gl_PointSize (Y >> X), giving the classic
 *     streak look without needing a line geometry.
 *
 *   OBSEDIA — obsediaRain.active === true.
 *     Black oil rain / Moon Rain / Starfall. Distinct state, never mixed
 *     with regular rain — Obsedia overrides. Near-black particles,
 *     heavier, slower and more viscous than normal rain, slightly
 *     randomised fall angles so it reads as "gooey" not "sharp."
 *     Intensity field (0–1) scales count and opacity continuously.
 *
 * Splash sprites: a small pool of flat quads spawned at Y = groundY
 * when a streak wraps back to the top. Fade out quickly (0.12s).
 * Kept cheap — max 32 splashes alive at any time.
 *
 * Integration:
 *   const rain = new RainSystem({ groundY: 0 });
 *   rain.addToScene(isoRenderer.scene);
 *   GodRayLayer.hideDuringOcclusion(rain.getObject3D());
 *   GodRayLayer.hideDuringOcclusion(rain.getSplashObject3D());
 *   // each frame, after syncSky():
 *   rain.update(deltaTime, {
 *     weatherState: sky.weatherState,
 *     wrongnessState: sky.wrongnessState,
 *     obsediaActive: sky.obsediaRain.active,
 *     obsediaIntensity: sky.obsediaRain.intensity,
 *   });
 */
import * as THREE from 'three';
import { WeatherType, WrongnessState } from '../types.js';
export interface RainSystemOptions {
    /** Y coordinate of the ground plane — splashes spawn here. Default 0. */
    groundY?: number;
    /** Half-extent of the XZ volume rain falls through. Default 14. */
    boundsXZ?: number;
    /** Vertical height of the rain column. Default 18. */
    boundsH?: number;
    /** Y at which rain particles spawn. Default groundY + boundsH. */
    topY?: number;
    /** Max particles for regular rain. Default 1800. */
    regularCount?: number;
    /** Max particles for Obsedia Rain. Default 2400. */
    obsediaCount?: number;
    /** Max simultaneous splash sprites. Default 32. */
    maxSplashes?: number;
}
export interface RainUpdateState {
    weatherState: WeatherType;
    wrongnessState: WrongnessState;
    obsediaActive: boolean;
    obsediaIntensity: number;
}
export declare class RainSystem {
    private regularPoints;
    private regularGeo;
    private regularMat;
    private regularCount;
    private obsediaPoints;
    private obsediaGeo;
    private obsediaMat;
    private obsediaCount;
    private splashPoints;
    private splashGeo;
    private splashMat;
    private splashPool;
    private maxSplashes;
    private splashPositions;
    private splashLifeAttr;
    private splashSizeAttr;
    private splashTimer;
    private splashInterval;
    private groundY;
    private boundsXZ;
    private boundsH;
    private topY;
    private currentMode;
    private targetOpacity;
    private currentOpacity;
    private scene;
    constructor(options?: RainSystemOptions);
    /** Returns the regular rain Points — pass to GodRayLayer.hideDuringOcclusion(). */
    getObject3D(): THREE.Object3D;
    /** Returns the Obsedia rain Points — also hide during occlusion. */
    getObsediaObject3D(): THREE.Object3D;
    /** Returns the splash ring Points — also hide during occlusion. */
    getSplashObject3D(): THREE.Object3D;
    addToScene(scene: THREE.Scene): void;
    removeFromScene(): void;
    /**
     * Call once per frame after IsometricRenderer.syncSky().
     * Determines active mode, fades opacity, ticks particle time uniforms,
     * and advances splash pool.
     */
    update(deltaTime: number, state: RainUpdateState): void;
    dispose(): void;
    private resolveMode;
    private applyMode;
    private tickTime;
    private updateSplashes;
    private buildRainPoints;
}
//# sourceMappingURL=RainSystem.d.ts.map