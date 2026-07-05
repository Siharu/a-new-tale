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
export class PixelPipeline {
    constructor(options = {}) {
        this.internalWidth = options.internalWidth ?? 384;
        this.internalHeight = options.internalHeight ?? 216;
        this.fixedPixelScale = options.pixelScale ?? null;
        this.renderTarget = new THREE.WebGLRenderTarget(this.internalWidth, this.internalHeight, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            generateMipmaps: false,
            colorSpace: THREE.SRGBColorSpace,
        });
        // Full-screen blit quad: its own minimal scene/camera, decoupled from
        // the game's IsometricRenderer scene entirely.
        this.blitScene = new THREE.Scene();
        this.blitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.blitMaterial = new THREE.MeshBasicMaterial({
            map: this.renderTarget.texture,
            depthTest: false,
            depthWrite: false,
        });
        this.blitMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blitMaterial);
        this.blitScene.add(this.blitMesh);
    }
    getRenderTarget() {
        return this.renderTarget;
    }
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
    renderScene(renderer, scene, camera) {
        renderer.setRenderTarget(this.renderTarget);
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, this.internalWidth, this.internalHeight);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
    }
    /**
     * Step 2: blit the low-res target up to the canvas's actual size with
     * nearest-neighbor sampling. Computes an integer pixel scale that fits
     * the canvas (letterboxing if the aspect doesn't divide evenly) unless
     * a fixed pixelScale was passed in the constructor.
     */
    blitToScreen(renderer, canvasWidth, canvasHeight) {
        this.blitTextureToScreen(renderer, this.renderTarget.texture, canvasWidth, canvasHeight);
    }
    /**
     * Same letterboxed nearest-neighbor upscale as blitToScreen(), but for
     * an arbitrary externally-supplied texture instead of this pipeline's
     * own render target. Used by GodRayLayer to blit its post-composited
     * (scene + rays) output through the identical pixel-perfect path —
     * without this, god rays would need their own separate blit/letterbox
     * logic that could drift out of sync with this one over time.
     */
    blitTextureToScreen(renderer, texture, canvasWidth, canvasHeight) {
        const scale = this.fixedPixelScale ?? Math.max(1, Math.floor(Math.min(canvasWidth / this.internalWidth, canvasHeight / this.internalHeight)));
        const drawWidth = this.internalWidth * scale;
        const drawHeight = this.internalHeight * scale;
        const offsetX = Math.floor((canvasWidth - drawWidth) / 2);
        const offsetY = Math.floor((canvasHeight - drawHeight) / 2);
        const prevMap = this.blitMaterial.map;
        this.blitMaterial.map = texture;
        renderer.setRenderTarget(null);
        renderer.setScissorTest(true);
        renderer.setScissor(offsetX, offsetY, drawWidth, drawHeight);
        renderer.setViewport(offsetX, offsetY, drawWidth, drawHeight);
        renderer.render(this.blitScene, this.blitCamera);
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, canvasWidth, canvasHeight);
        this.blitMaterial.map = prevMap; // restore — blitToScreen() relies on this staying its own texture
    }
    dispose() {
        this.renderTarget.dispose();
        this.blitMaterial.dispose();
        this.blitMesh.geometry.dispose();
    }
}
//# sourceMappingURL=PixelPipeline.js.map