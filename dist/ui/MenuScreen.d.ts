import { WrongnessState } from '../types.js';
import type { Zone } from '../types.js';
import type { GameplayEngine } from '../gameplay/index.js';
import type { DrifterAudio } from './DrifterAudio.js';
export interface GameSettings {
    difficulty: number;
    volume: number;
    showHints: boolean;
}
export declare function loadSettings(): GameSettings;
export declare function saveSettings(s: GameSettings): void;
export type AppMode = 'menu' | 'story' | 'exploration' | 'settings' | 'play' | 'loading' | 'briefing';
export interface MenuScreenCallbacks {
    onStartRun(mode: 'story' | 'exploration'): void;
    onWrongnessChange(state: WrongnessState): void;
    onVolumeChange(volume: number): void;
    onSettingsSave(settings: GameSettings): void;
}
export declare class MenuScreen {
    private root;
    private audio;
    private callbacks;
    settings: GameSettings;
    wrongnessState: WrongnessState;
    private mode;
    private menuIndex;
    private statusMessage;
    private noiseInterval;
    currentZone: Zone | null;
    engine: GameplayEngine | null;
    pendingMode: 'story' | 'exploration';
    private menuDateInitialized;
    private menuDateValue;
    private bgFolder;
    constructor(rootEl: HTMLElement, audio: DrifterAudio, callbacks: MenuScreenCallbacks);
    setMode(mode: AppMode): void;
    setStatus(msg: string): void;
    setWrongness(state: WrongnessState): void;
    rotateBg(): void;
    /** Full DOM rebuild for the current mode. */
    render(): void;
    destroy(): void;
    private clearNoiseInterval;
    private buildScanlines;
    private buildNoise;
    private buildBackground;
    private buildMenuOverlay;
    private buildTitle;
    private buildStatusInline;
    private buildNavItems;
    private buildTagline;
    private buildSplitLayout;
    private buildStoryPanel;
    private buildExplorationPanel;
    private buildSettingsPanel;
    private makeSlider;
    buildLoadingScreen(): HTMLElement;
    buildBriefingScreen(): HTMLElement;
    private buildSignalMeter;
    buildPlayHUD(runtime: {
        canvas: HTMLCanvasElement;
        minimapCanvas: HTMLCanvasElement;
        worldMapCanvas: HTMLCanvasElement;
        broadcastElement: HTMLDivElement;
        handleResize(): void;
    }, onMenu: () => void): HTMLElement;
    private getMenuDateTime;
    private pickBg;
}
//# sourceMappingURL=MenuScreen.d.ts.map