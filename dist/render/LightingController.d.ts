/**
 * LightingController
 * Step 2.4 in the rendering build order (SkySystem -> IsometricRenderer/
 * PixelPipeline -> LightingController -> GodRayLayer -> ...).
 *
 * SkySystem already produces a correctly-colored/positioned directional
 * light (sun or moon) per bake, and IsometricRenderer.syncSky() copies its
 * color/intensity/position onto the scene's light each frame. What's
 * missing — and what this class owns — is everything that makes that light
 * actually feel like the references (13 Sentinels, Octopath): shadow
 * casting, and the relationship between sun ANGLE and shadow LENGTH/
 * SOFTNESS that those games lean on so heavily at dawn/dusk.
 *
 * Deliberately separate from SkySystem (color/position only, no renderer
 * concerns) and from IsometricRenderer (owns the scene/camera, not shadow
 * tuning) — same separation-of-concerns the file structure already uses
 * for PixelPipeline vs IsometricRenderer.
 *
 * Usage:
 *   const lighting = new LightingController(isoRenderer.renderer);
 *   lighting.attach(isoRenderer.scene, isoRenderer.directionalLight, isoRenderer.camera);
 *   // each frame, AFTER isoRenderer.syncSky():
 *   lighting.update(sky.lastSunY01, sky.isNight);  // or however angle is sourced
 *
 * Shadow casters: call lighting.registerCaster(mesh) / registerReceiver(mesh)
 * as building/ground geometry comes online in later milestones. Nothing
 * here assumes specific game content — it's content-agnostic by design,
 * same as IsometricRenderer's M2 scope.
 */
import * as THREE from 'three';
export interface LightingControllerOptions {
    shadowMapSize?: number;
    fillLightColor?: number;
    fillLightIntensity?: number;
    minShadowSoftness?: number;
    maxShadowSoftness?: number;
}
export declare class LightingController {
    private renderer;
    private scene;
    private keyLight;
    private fillLight;
    private sceneCamera;
    private shadowMapSize;
    private fillColor;
    private fillIntensity;
    private minSoft;
    private maxSoft;
    private casters;
    private sceneRadius;
    constructor(renderer: THREE.WebGLRenderer, options?: LightingControllerOptions);
    /**
     * Wires shadow casting onto IsometricRenderer's existing directional
     * light, and adds the cool fill light to the same scene. Call once,
     * after IsometricRenderer.attachSky() has created the key light.
     */
    attach(scene: THREE.Scene, keyLight: THREE.DirectionalLight, sceneCamera: THREE.Camera): void;
    /**
     * Sizes the shadow camera's ortho frustum to the play area. Call again
     * whenever zone bounds change size (e.g. on ZoneStreamer load) — too
     * tight clips shadows at the edges, too loose wastes shadow-map resolution.
     */
    fitToScene(radius: number): void;
    private fitShadowFrustum;
    /** Mark a mesh as something that should cast/receive shadows. Idempotent. */
    registerCaster(mesh: THREE.Mesh, receivesToo?: boolean): void;
    registerReceiverOnly(mesh: THREE.Mesh): void;
    unregister(mesh: THREE.Mesh): void;
    /**
     * Call once per frame, AFTER IsometricRenderer.syncSky() has pushed the
     * latest sun/moon color+position onto the key light. Reshapes shadow
     * softness and positions the fill light opposite the key light based on
     * how low the light angle currently is.
     *
     * @param sunElevation01  0 = light at the horizon (dawn/dusk), 1 = light
     *                        directly overhead (noon). Derive from SkySystem's
     *                        sunY (1 - sunY, roughly) or pass through directly
     *                        if SkySystem exposes elevation later.
     * @param isNight         dims the fill light further at night so it
     *                        doesn't fight the moon's already-low intensity.
     */
    update(sunElevation01: number, isNight: boolean): void;
    /** Returns the camera passed to attach() — handy for GodRayLayer's worldToScreen01() reusing the same camera. */
    getSceneCamera(): THREE.Camera | null;
    dispose(): void;
}
//# sourceMappingURL=LightingController.d.ts.map