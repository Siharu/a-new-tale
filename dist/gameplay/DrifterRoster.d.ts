import type { Drifter, RunID, Vector2, ZoneID } from '../types.js';
import { DrifterEntity } from './DrifterEntity.js';
export declare class DrifterRoster {
    private roster;
    private rng;
    constructor(seed: number);
    addSurvivor(drifter: Drifter): void;
    drawDrifter(runID: RunID, currentZone: ZoneID, position: Vector2): DrifterEntity;
    listSurvivors(): Drifter[];
    private cloneDrifter;
}
//# sourceMappingURL=DrifterRoster.d.ts.map