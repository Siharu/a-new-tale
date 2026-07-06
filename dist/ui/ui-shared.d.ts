import { WrongnessState } from '../types.js';
export declare function el<K extends keyof HTMLElementTagNameMap>(tag: K, styles?: Partial<CSSStyleDeclaration>): HTMLElementTagNameMap[K];
export declare function createNoiseCanvas(opacity: number): HTMLCanvasElement;
export interface WrongnessPalette {
    panelBg: string;
    borderColor: string;
    accentColor: string;
    textPrimary: string;
    textSecondary: string;
    noiseOpacity: number;
    scanlineOpacity: number;
    glitch: boolean;
    label: string;
    skyFilter: string;
}
export declare const WRONGNESS_PALETTE: Record<WrongnessState, WrongnessPalette>;
export declare function applyThemeVars(wrongness: WrongnessState): void;
export declare function injectGlobalStyles(): void;
//# sourceMappingURL=ui-shared.d.ts.map