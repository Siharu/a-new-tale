/**
 * PixelPipeline
 * Renders a scene at a fixed LOW internal resolution into an offscreen
 * render target (nearest-filtered, no mipmaps), then blits that texture
 * up to the real canvas size with nearest-neighbor sampling — the crisp
 * "pixel-perfect HD-2D" look (Octopath Traveler / 13 Sentinels style),
 * as opposed to a blurry bilinear upscale.
 *
 * Deliberately a separate class from IsometricRenderer (per the file
 * structure in DRIFTER_ENGINE_PLAN.md) — IsometricRenderer owns the
 * camera/scene, PixelPipeline only owns the resolution/blit concern, so
 * either can be swapped independently later (e.g. dynamic res scaling).
 *
 * v2 — added blitTextureToScreen() so GodRayLayer's post-composited output
 * (scene + crepuscular rays, same internal resolution) can reuse the exact
 * same letterboxed nearest-neighbor blit path as the raw scene render,
 * instead of duplicating that math in a second place.
 */
import * as THREE from 'three';
export interface PixelPipelineOptions {
    internalWidth?: number;
    internalHeight?: number;
    pixelScale?: number;
}
export declare class PixelPipeline {
    readonly internalWidth: number;
    readonly internalHeight: number;
    private renderTarget;
    private blitScene;
    private blitCamera;
    private blitMesh;
    private blitMaterial;
    private fixedPixelScale;
    constructor(options?: PixelPipelineOptions);
    getRenderTarget(): THREE.WebGLRenderTarget;
    /**
     * Step 1: render the real scene at low internal resolution into the
     * offscreen target. Call this with the game's actual scene/camera.
     *
     * Explicitly resets the viewport/scissor to the target's own
     * internalWidth/Height before rendering. This is required because
     * Three.js's renderer.setRenderTarget() does NOT reset the viewport —
     * it's independent state. blitToScreen() sets a custom (often
     * letterboxed) viewport for the final canvas-sized blit; without this
     * reset, the next frame's render-to-target call would inherit that
     * stale viewport and render the scene cropped/zoomed into a corner of
     * the low-res buffer instead of filling it correctly.
     */
    renderScene(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void;
    /**
     * Step 2: blit the low-res target up to the canvas's actual size with
     * nearest-neighbor sampling. Computes an integer pixel scale that fits
     * the canvas (letterboxing if the aspect doesn't divide evenly) unless
     * a fixed pixelScale was passed in the constructor.
     */
    blitToScreen(renderer: THREE.WebGLRenderer, canvasWidth: number, canvasHeight: number): void;
    /**
     * Same letterboxed nearest-neighbor upscale as blitToScreen(), but for
     * an arbitrary externally-supplied texture instead of this pipeline's
     * own render target. Used by GodRayLayer to blit its post-composited
     * (scene + rays) output through the identical pixel-perfect path —
     * without this, god rays would need their own separate blit/letterbox
     * logic that could drift out of sync with this one over time.
     */
    blitTextureToScreen(renderer: THREE.WebGLRenderer, texture: THREE.Texture, canvasWidth: number, canvasHeight: number): void;
    dispose(): void;
}
//# sourceMappingURL=PixelPipeline.d.ts.map