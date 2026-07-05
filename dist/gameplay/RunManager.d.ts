import { Drifter, Run, RunSummary, Vector2, Zone } from '../types.js';
export declare enum RunPhase {
    HQ = "HQ",
    EXPLORATION = "EXPLORATION",
    RESOLUTION = "RESOLUTION"
}
export interface RunManagerOptions {
    seed: number;
    hqPosition: Vector2;
    maxHistory?: number;
}
export declare class RunManager {
    private currentRun;
    private history;
    private options;
    constructor(options: RunManagerOptions);
    startRun(drifter: Drifter, zone: Zone): Run;
    recordResource(item: unknown): void;
    recordLogbookEntry(entry: unknown): void;
    recordDeduction(entry: unknown): void;
    failRun(causeOfDeath: string): Run | null;
    completeRun(): Run | null;
    getCurrentRun(): Run | null;
    getHistory(): RunSummary[];
    clearHistory(): void;
    private storeSummary;
}
//# sourceMappingURL=RunManager.d.ts.map