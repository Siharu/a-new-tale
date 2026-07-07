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

export class SVGRasterizer {
  private cache: Map<string, THREE.CanvasTexture> = new Map();

  constructor() {}

  /**
   * Bake an SVG markup string into a THREE.CanvasTexture, synchronously.
   * Returns a cached texture if the same cacheKey was baked before.
   */
  bakeImmediate(svgMarkup: string, options: BakeOptions): THREE.CanvasTexture {
    const cached = this.cache.get(options.cacheKey);
    if (cached) {
      return cached;
    }

    const texture = this.rasterizeSync(svgMarkup, options);
    this.cache.set(options.cacheKey, texture);
    return texture;
  }

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
  rebake(svgMarkup: string, options: BakeOptions): THREE.CanvasTexture {
    const texture = this.rasterizeSync(svgMarkup, options);
    this.cache.set(options.cacheKey, texture);
    return texture;
  }

  /**
   * Drop a cached texture (e.g. on zone unload, per the ZoneStreamer LRU
   * eviction concept from the architecture notes) and dispose its GPU
   * resources so it doesn't leak.
   */
  evict(cacheKey: string): void {
    const tex = this.cache.get(cacheKey);
    if (tex) {
      tex.dispose();
      this.cache.delete(cacheKey);
    }
  }

  /** Drop every cached texture and dispose all GPU resources. */
  clear(): void {
    for (const tex of this.cache.values()) {
      tex.dispose();
    }
    this.cache.clear();
  }

  get cacheSize(): number {
    return this.cache.size;
  }

  // ─── internal ───

  private rasterizeSync(svgMarkup: string, options: BakeOptions): THREE.CanvasTexture {
    const { width, height, background } = options;

    // Dedicated canvas per bake — NOT a shared scratch canvas cloned via
    // cloneNode(). cloneNode() only copies DOM attributes (width/height),
    // never the drawn bitmap: the clone comes back fully blank regardless
    // of what was painted onto the source canvas beforehand. That bug used
    // to hand THREE.CanvasTexture a permanently-empty/transparent image
    // whenever the async <img> decode below didn't land (or hadn't landed
    // yet), which is exactly why buildings baked through this path could
    // render invisible. Drawing directly onto the same canvas instance the
    // texture wraps guarantees the fallback (and later the real SVG) is
    // actually visible on the GPU-uploaded content.
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('SVGRasterizer: failed to acquire 2D canvas context');
    }

    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }

    // Wrap the markup in a properly-sized root <svg> if the caller passed
    // bare inner content (rects/paths/etc without a wrapping <svg> tag) —
    // SVGBuildingFactory generates inner markup, not a full document, so
    // this keeps callers simple (they just emit shapes, not boilerplate).
    const fullSvg = svgMarkup.trimStart().startsWith('<svg')
      ? svgMarkup
      : `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${svgMarkup}</svg>`;

    // Draw a deterministic procedural fallback immediately (so geometry
    // never ends up textureless), then upgrade the texture's content in
    // place once the real image decodes — Three.js picks this up
    // automatically via texture.needsUpdate. The <img> decode is
    // asynchronous even for blob: URLs in practice, so bakeImmediate must
    // not depend on it having landed by the time it returns.
    this.drawFallback(ctx, width, height, background);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;

    const svgBlob = new Blob([fullSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      ctx.clearRect(0, 0, width, height);
      if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(img, 0, 0, width, height);
      texture.needsUpdate = true;
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      // Keep the fallback draw already on the texture; just clean up.
      URL.revokeObjectURL(url);
    };
    img.src = url;

    return texture;
  }

  /**
   * Deterministic placeholder content drawn immediately so a texture is
   * never blank/transparent while the real SVG decode is in flight. Kept
   * intentionally simple (flat tone + a faint grid) rather than trying to
   * synchronously parse the SVG markup ourselves.
   */
  private drawFallback(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    background?: string
  ): void {
    ctx.fillStyle = background ?? '#2a2a2a';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    const step = 16;
    for (let x = 0; x <= width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }
}
