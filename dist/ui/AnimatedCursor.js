/**
 * AnimatedCursor
 * Converts the Windows .ANI "Glitchy" cursor set (pre-extracted as base64 PNG
 * frames in cursorData.ts) into real animated web cursors using a hidden canvas
 * that cycles through frames and writes `cursor: url(data:…)` on the target.
 *
 * Usage:
 *   const ac = new AnimatedCursor();
 *   ac.apply(document.body);          // default glitch cursor on whole page
 *   ac.applyType(btn, 'pointer');     // select-glitch on a button
 *   ac.destroy();                     // clean up all intervals + canvas refs
 */
import { CURSOR_DATA } from './cursorData.js';
/** Pre-load all images for a cursor type and return them. */
function loadImages(type) {
    const data = CURSOR_DATA[type];
    return Promise.all(data.frames.map(src => new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = src;
    })));
}
export class AnimatedCursor {
    constructor() {
        this.cursors = new Map();
        this.targetMap = new Map();
    }
    /** Apply the default glitch cursor to an element. */
    apply(el) {
        this.applyType(el, 'default');
    }
    /** Apply a specific cursor type to an element. */
    applyType(el, type) {
        // Track what type this element wants
        this.targetMap.set(el, type);
        // If cursor state for this type isn't started yet, start it
        if (!this.cursors.has(type)) {
            this.startCursor(type);
        }
        const state = this.cursors.get(type);
        state.targets.add(el);
        // Apply current frame immediately if images are loaded
        if (state.imagesLoaded === state.images.length && state.images.length > 0) {
            this.applyFrame(state);
        }
    }
    /** Remove cursor from an element (reverts to auto). */
    remove(el) {
        const type = this.targetMap.get(el);
        if (!type)
            return;
        this.targetMap.delete(el);
        el.style.cursor = 'auto';
        const state = this.cursors.get(type);
        if (state) {
            state.targets.delete(el);
            if (state.targets.size === 0) {
                this.stopCursor(type);
            }
        }
    }
    /** Destroy all cursors and clean up. */
    destroy() {
        for (const [type] of this.cursors) {
            this.stopCursor(type);
        }
        this.cursors.clear();
        this.targetMap.clear();
    }
    startCursor(type) {
        const data = CURSOR_DATA[type];
        const canvas = document.createElement('canvas');
        canvas.width = data.w;
        canvas.height = data.h;
        const ctx = canvas.getContext('2d');
        const state = {
            frameIndex: 0,
            interval: 0,
            canvas,
            ctx,
            images: [],
            imagesLoaded: 0,
            type,
            targets: new Set(),
        };
        this.cursors.set(type, state);
        // Pre-load all frame images
        loadImages(type).then(imgs => {
            if (!this.cursors.has(type))
                return; // was destroyed while loading
            state.images = imgs;
            state.imagesLoaded = imgs.length;
            // Draw first frame immediately
            this.applyFrame(state);
            // Start animation loop
            state.interval = setInterval(() => {
                if (!this.cursors.has(type))
                    return;
                state.frameIndex = (state.frameIndex + 1) % state.images.length;
                this.applyFrame(state);
            }, data.ms);
        }).catch(() => {
            // Fallback: just leave cursor as auto on load failure
        });
    }
    stopCursor(type) {
        const state = this.cursors.get(type);
        if (!state)
            return;
        clearInterval(state.interval);
        // Revert all targets
        for (const el of state.targets) {
            el.style.cursor = 'auto';
        }
        this.cursors.delete(type);
    }
    applyFrame(state) {
        const data = CURSOR_DATA[state.type];
        const img = state.images[state.frameIndex];
        if (!img)
            return;
        state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
        state.ctx.drawImage(img, 0, 0);
        const dataUrl = state.canvas.toDataURL('image/png');
        const cursorCss = `url("${dataUrl}") ${data.hx} ${data.hy}, auto`;
        for (const el of state.targets) {
            el.style.cursor = cursorCss;
        }
    }
}
/** Singleton instance shared across the app. */
export const cursor = new AnimatedCursor();
//# sourceMappingURL=AnimatedCursor.js.map