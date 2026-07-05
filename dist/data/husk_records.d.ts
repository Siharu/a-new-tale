/**
 * THREAT RECORDS — INITIAL TAXONOMY
 *
 * File holds ALL threat types discovered in the Another Sky outbreak:
 * - 9 Husk variants (humans who rejected reality completely)
 * - 5 Infected variants (humans in partial rejection, can think/plan)
 * - 1 Ghuul type (apex threat: accepted truth without rejecting, retains agency)
 *
 * All entries are written from a **scared survivor's perspective** —
 * what a Drifter observes through behavior/senses ONLY.
 *
 * ⚠️ CRITICAL SPOILER RULE:
 * Real mechanism (psychological rejection of breaking reality) is end-game revelation.
 * NEVER reference it in these entries. Write only behavioral observations.
 *
 * What Drifters know: Unknown pathogen, bite transmission observed,
 * in-world theories (signal rewiring, prions, virus, fungus, hallucinations).
 * What NEVER appears: "rejected reality", "the veil", "dimensional exposure",
 * "psychological response to truth".
 */
import { HuskType, InfectedType, GhuulType, DetectionMethod } from '../types.js';
export interface HuskRecord {
    id: string;
    type: HuskType;
    discoveredName: string | null;
    physicalTraits: string;
    detectionMethods: DetectionMethod[];
    behavior: string;
    threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    weakness: string;
    preventionTip: string;
    encounterCount: number;
    firstSightedTime?: number;
    notes: string;
}
export interface InfectedRecord {
    id: string;
    type: InfectedType;
    discoveredName: string | null;
    physicalTraits: string;
    detectionMethods: DetectionMethod[];
    behavior: string;
    threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    weakness: string;
    preventionTip: string;
    encounterCount: number;
    firstSightedTime?: number;
    notes: string;
}
export interface GhuulRecord {
    id: string;
    type: GhuulType;
    discoveredName: string | null;
    physicalTraits: string;
    detectionMethods: DetectionMethod[];
    behavior: string;
    threatLevel: 'EXTREME';
    weakness: string;
    preventionTip: string;
    encounterCount: number;
    firstSightedTime?: number;
    notes: string;
}
export declare const INITIAL_HUSK_RECORDS: HuskRecord[];
export declare const INITIAL_INFECTED_RECORDS: InfectedRecord[];
export declare const INITIAL_GHUUL_RECORD: GhuulRecord;
//# sourceMappingURL=husk_records.d.ts.map