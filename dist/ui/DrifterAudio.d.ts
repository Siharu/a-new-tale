import { WrongnessState } from '../types.js';
export declare class DrifterAudio {
    private ctx;
    private master;
    private volume;
    private droneOscs;
    private droneGains;
    private noiseSource;
    private noiseFilter;
    private noiseGain;
    private melodyTimer;
    private ambientRunning;
    private currentWrongness;
    setVolume(v: number): void;
    startAmbient(wrongness?: WrongnessState): void;
    stopAmbient(): void;
    applyWrongness(wrongness: WrongnessState): void;
    dispose(): void;
    playHover(): void;
    playSelect(): void;
    playBack(): void;
    playDeploy(): void;
    playAbort(): void;
    private getCtx;
    private wrongnessParams;
    private buildAmbient;
    private scheduleMelody;
    private wrongnessGap;
    private uiSound;
    private tone;
    private staticBurst;
}
//# sourceMappingURL=DrifterAudio.d.ts.map