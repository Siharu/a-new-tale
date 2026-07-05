/**
 * SVGRasterizer
 * Shared bake utility: takes an SVG markup string and rasterizes it onto
 * an offscreen canvas, returning a THREE.CanvasTexture ready to apply to
 * a plane/mesh. This is the bridge between "authored as SVG" (cheap,
 * procedural, data-driven) and "rendered in Three.js" (needs a texture,
 * not live DOM/vector content) — per the locked SVG-procedural-generation
 * decision, every visual surface in DRIFTER goes through this one path.
 *
 * Used by SVGBuildingFactory (building facades/roofs) and can be reused
 * by any future SVGPropFactory/SVGAnomalyFactory work without changes.
 *
 * `bakeImmediate` is intentionally synchronous — building geometry needs
 * the texture available the moment the mesh is constructed, not after an
 * async round-trip. This trades the "rasterize on a worker thread" idea
 * from the original architecture notes for "rasterize on the main thread
 * via a 2D canvas context", which is simpler, has zero dependency on
 * OffscreenCanvas/Worker support, and is fast enough for the bake sizes
 * we use (256x256-ish facades, not full-screen content).
 */
import * as THREE from 'three';
export interface BakeOptions {
    width: number;
    height: number;
    /**
     * Cache key for this exact bake. If a texture was already baked under
     * this key, the cached THREE.CanvasTexture is returned instead of
     * re-rasterizing — this is what makes repeated/similar buildings across
     * a zone cheap (SVGBuildingFactory builds cacheKey from building type +
     * seed + decay bucket + dimensions, so visually-identical buildings
     * share one texture instance).
     */
    cacheKey: string;
    /**
     * Optional background fill applied before the SVG draws, in case the
     * SVG markup doesn't cover the full canvas (transparent areas would
     * otherwise show through as fully transparent rather than a fallback
     * color). Defaults to fully transparent (no fill).
     */
    background?: string;
}
export declare class SVGRasterizer {
    private cache;
    private canvas;
    private ctx;
    constructor();
    /**
     * Bake an SVG markup string into a THREE.CanvasTexture, synchronously.
     * Returns a cached texture if the same cacheKey was baked before.
     */
    bakeImmediate(svgMarkup: string, options: BakeOptions): THREE.CanvasTexture;
    /**
     * Force a re-bake even if a cached entry exists under this key —
     * useful when a building's decayState crosses a bucket threshold and
     * its facade genuinely needs to look different now. Replaces the
     * cache entry in place so existing mesh references to the old texture
     * still work (Three.js textures are mutated via .needsUpdate, not
     * swapped — but since callers hold the returned object, simplest here
     * is just returning a fresh texture and letting the caller re-assign
     * it to their material).
     */
    rebake(svgMarkup: string, options: BakeOptions): THREE.CanvasTexture;
    /**
     * Drop a cached texture (e.g. on zone unload, per the ZoneStreamer LRU
     * eviction concept from the architecture notes) and dispose its GPU
     * resources so it doesn't leak.
     */
    evict(cacheKey: string): void;
    /** Drop every cached texture and dispose all GPU resources. */
    clear(): void;
    get cacheSize(): number;
    private rasterizeSync;
    /**
     * Deterministic placeholder content drawn immediately so a texture is
     * never blank/transparent while the real SVG decode is in flight. Kept
     * intentionally simple (flat tone + a faint grid) rather than trying to
     * synchronously parse the SVG markup ourselves.
     */
    private drawFallback;
}
//# sourceMappingURL=SVGRasterizer.d.ts.map