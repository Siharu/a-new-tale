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
type CursorType = keyof typeof CURSOR_DATA;
export declare class AnimatedCursor {
    private cursors;
    private targetMap;
    /** Apply the default glitch cursor to an element. */
    apply(el: HTMLElement): void;
    /** Apply a specific cursor type to an element. */
    applyType(el: HTMLElement, type: CursorType): void;
    /** Remove cursor from an element (reverts to auto). */
    remove(el: HTMLElement): void;
    /** Destroy all cursors and clean up. */
    destroy(): void;
    private startCursor;
    private stopCursor;
    private applyFrame;
}
/** Singleton instance shared across the app. */
export declare const cursor: AnimatedCursor;
export {};
//# sourceMappingURL=AnimatedCursor.d.ts.map