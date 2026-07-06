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
    /** Soft footstep crunch — plays on movement, called externally every ~0.4s while moving. */
    playFootstep(): void;
    /** Low husk growl/click — plays when a husk enters ATTACKING state. */
    playHuskAggro(): void;
    /** Short attack hit — plays when drifter takes damage. */
    playHurt(): void;
    /** Drifter death — heavy thud, signal dropout. */
    playDeath(): void;
    /** Item pickup — short confirmation ping. */
    playPickup(): void;
    /** Goal progress update — plays when catalog count increases. */
    playGoalProgress(): void;
    /** Goal complete — plays when all catalogs done, extraction unlocked. */
    playGoalComplete(): void;
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