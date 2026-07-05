/**
 * GodRayLayer
 * Step 2.5 in the rendering build order (... -> LightingController ->
 * GodRayLayer -> DustParticles -> ...).
 *
 * Classic "GPU Gems crepuscular rays" technique, hand-rolled with a raw
 * THREE.ShaderMaterial rather than pulling in three/examples/postprocessing
 * — matches the existing convention set by PixelPipeline (manual render
 * target + full-screen quad blit, no external post stack).
 *
 * Two passes:
 *   1. Occlusion pass: render the scene as near-white sky / near-black
 *      silhouettes (only emissive/sky stays bright) into a small offscreen
 *      target, sized to PixelPipeline's internal resolution so cost stays
 *      cheap and the ray pattern matches the game's actual pixel grid
 *      rather than looking like a high-res overlay slapped on a low-res game.
 *   2. Radial blur pass: repeatedly sample that occlusion texture toward
 *      the light's screen-space position, accumulating a streak — this is
 *      what produces the beam look in reference image 2 and the shafts
 *      through the windows in image 4.
 * The result is additively blended onto the main render before
 * PixelPipeline.blitToScreen() upscales everything together, so god rays
 * inherit the same pixel-perfect nearest-neighbor look as the rest of the
 * scene rather than looking like a smooth modern overlay.
 *
 * Usage (inside IsometricRenderer.render(), after pixelPipeline.renderScene()
 * and before pixelPipeline.blitToScreen()):
 *   godRays.renderOcclusion(renderer, scene, camera, occlusionOverrideMaterial);
 *   godRays.composite(renderer, pixelPipeline.getRenderTarget(), lightScreenPos);
 */
import * as THREE from 'three';
export interface GodRayLayerOptions {
    width?: number;
    height?: number;
    exposure?: number;
    decay?: number;
    density?: number;
    weight?: number;
    rayColor?: THREE.Color;
}
export declare class GodRayLayer {
    private width;
    private height;
    private occlusionTarget;
    private occlusionOverrideMaterial;
    private skyOcclusionExemptTag;
    private occlusionHideTag;
    private compositeTarget;
    private compositeScene;
    private compositeCamera;
    private compositeMesh;
    private compositeMaterial;
    intensity: number;
    constructor(options?: GodRayLayerOptions);
    /**
     * Tag a mesh (e.g. the sky dome, or any emissive element) so the
     * occlusion pass renders it as bright/transparent rather than a black
     * silhouette — without this, the sky dome itself would block its own
     * light source's rays at the source, which defeats the effect.
     */
    static exemptFromOcclusion(mesh: THREE.Object3D): void;
    /**
     * Tag a non-Mesh additive effect (DustParticles' THREE.Points, future
     * sprite-based effects, etc.) to be temporarily hidden during the
     * occlusion pass rather than material-swapped — see occlusionHideTag
     * above for why Points need different handling than Mesh silhouettes.
     */
    static hideDuringOcclusion(object: THREE.Object3D): void;
    /** Update the ray tint to match the current sun/moon glow color from SkySystem, for cohesion with the sky bake. */
    setRayColor(color: THREE.Color): void;
    /**
     * Pass 1: render the scene with all real materials swapped for solid
     * black, EXCEPT meshes tagged via exemptFromOcclusion() (the sky dome),
     * which render as their actual bright texture. This produces a
     * black-silhouettes-on-bright-sky mask that the radial blur then streaks
     * outward from the light position.
     */
    renderOcclusion(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void;
    /**
     * Pass 2: radial-blur the occlusion mask toward the light's screen
     * position and additively composite onto the already-rendered scene
     * texture (PixelPipeline's render target), writing into this layer's own
     * compositeTarget. Caller is responsible for blitting compositeTarget's
     * texture to screen instead of PixelPipeline's raw target afterward.
     *
     * @param sceneTexture     PixelPipeline.getRenderTarget().texture — the
     *                         normal lit/shaded scene render for this frame.
     * @param lightScreenPos01 light's position in 0..1 screen space (NDC * 0.5
     *                         + 0.5). Can be outside [0,1] — rays still read
     *                         correctly streaming in from off-screen, which
     *                         matters for low sun angles near the camera edge.
     */
    composite(renderer: THREE.WebGLRenderer, sceneTexture: THREE.Texture, lightScreenPos01: THREE.Vector2): void;
    /** Final composited (scene + rays) texture — blit this instead of PixelPipeline's raw target. */
    getOutputTexture(): THREE.Texture;
    /**
     * Projects a world-space light position (e.g. SkySystem's directional
     * light position, or a point far along its direction) into the 0..1
     * screen-space coordinate composite() expects.
     */
    static worldToScreen01(worldPos: THREE.Vector3, camera: THREE.Camera): THREE.Vector2;
    handleResize(width: number, height: number): void;
    dispose(): void;
}
//# sourceMappingURL=GodRayLayer.d.ts.map