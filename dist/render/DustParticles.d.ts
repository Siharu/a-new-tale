/**
 * DustParticles
 * Step 2.6 in the rendering build order (... -> GodRayLayer -> DustParticles
 * -> AtmosphereController -> ...).
 *
 * The "light rays in the dust" look from the references (image 2's beam,
 * image 4's window shafts) isn't really about GodRayLayer alone — what
 * sells it is dust motes catching that light. This is a single GPU point-
 * sprite system, additively blended, where each particle's brightness is
 * driven by how "backlit" it is relative to the current key light: motes
 * sitting between the camera and the light glow noticeably brighter than
 * ones lit from the front, which is the real-world Mie-scattering cue our
 * eyes read as "floating in a sunbeam." Cheap approximation (a dot product
 * in the fragment shader), not real volumetrics — fits the hand-rolled-
 * shader convention already set by GodRayLayer rather than pulling in a
 * particle library.
 *
 * All seeded via the existing SeededRandom (utils.ts) so a zone's dust
 * field is stable/reproducible per zone.seed, same convention SkySystem
 * already uses for its stars/clouds (there via its own mulberry32 — kept
 * separate there since SkySystem predates this file and re-baking its
 * RNG would risk shifting already-tuned star/cloud positions; new systems
 * from here on should use SeededRandom for consistency).
 *
 * Usage:
 *   const dust = new DustParticles({ count: 200, bounds: viewSize * 1.5, zoneSeed: zone.seed });
 *   dust.addToScene(isoRenderer.scene);
 *   // each frame, after syncSky():
 *   dust.update(deltaTime, isoRenderer.directionalLightWorldPos, sky.fogColor /* or sunMoon tint *\/, fogIntensity);
 */
import * as THREE from 'three';
export interface DustParticlesOptions {
    count?: number;
    bounds?: number;
    zoneSeed?: number;
    minSize?: number;
    maxSize?: number;
    minSpeed?: number;
    maxSpeed?: number;
    baseColor?: THREE.Color;
}
export declare class DustParticles {
    private points;
    private geometry;
    private material;
    private bounds;
    private count;
    private elapsed;
    private addedToScene;
    constructor(options?: DustParticlesOptions);
    private populate;
    /** Re-seed the whole field — call on zone change so each region gets a stable-but-distinct dust layout. */
    reseed(zoneSeed: number, minSize?: number, maxSize?: number, minSpeed?: number, maxSpeed?: number): void;
    /** Exposes the underlying THREE.Points object — needed so callers (e.g. IsometricRenderer) can tag it via GodRayLayer.hideDuringOcclusion() before adding it to the scene. */
    getObject3D(): THREE.Points;
    addToScene(scene: THREE.Scene): void;
    removeFromScene(): void;
    /**
     * Call once per frame, ideally right after IsometricRenderer.syncSky()
     * so lightWorldPos/rayColor reflect the current bake.
     *
     * @param deltaTime    seconds since last frame
     * @param lightWorldPos  the key light's world position (e.g.
     *                       isoRenderer's directional light .position) —
     *                       drives the backlit-brightness cue
     * @param rayColor     tint to shift backlit motes toward; pass the same
     *                     color GodRayLayer.setRayColor() received so dust
     *                     and rays read as one coherent light source
     * @param fogOrHazeIntensity  0–1, scales overall dust opacity — heavier
     *                            fog/haze makes suspended dust read as MORE
     *                            visible (it's catching ambient scatter), not
     *                            less, so this is a direct (not inverse) mix
     */
    update(deltaTime: number, lightWorldPos: THREE.Vector3, rayColor: THREE.Color, fogOrHazeIntensity?: number): void;
    /** Direct opacity override if a caller wants to fade dust out entirely (e.g. indoors, or during Obsedia Rain where streaks replace it). */
    setOpacity(value: number): void;
    dispose(): void;
}
//# sourceMappingURL=DustParticles.d.ts.map