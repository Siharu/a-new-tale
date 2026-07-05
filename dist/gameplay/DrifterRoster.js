import { SeededRandom } from '../utils.js';
import { DrifterEntity } from './DrifterEntity.js';
export class DrifterRoster {
    constructor(seed) {
        this.roster = [];
        this.rng = new SeededRandom(seed);
    }
    addSurvivor(drifter) {
        const exists = this.roster.some((entry) => entry.id === drifter.id);
        if (exists) {
            return;
        }
        this.roster.push(this.cloneDrifter(drifter));
    }
    drawDrifter(runID, currentZone, position) {
        const shouldReuse = this.roster.length > 0 && this.rng.next() <= 0.2;
        if (shouldReuse) {
            const candidate = this.cloneDrifter(this.rng.pick(this.roster));
            return DrifterEntity.createFromRoster(candidate, runID, currentZone, position);
        }
        return DrifterEntity.createFresh(runID, currentZone, position);
    }
    listSurvivors() {
        return this.roster.map((entry) => this.cloneDrifter(entry));
    }
    cloneDrifter(drifter) {
        return JSON.parse(JSON.stringify(drifter));
    }
}
//# sourceMappingURL=DrifterRoster.js.map