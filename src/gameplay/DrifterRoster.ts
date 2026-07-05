import type { Drifter, RunID, Vector2, ZoneID } from '../types.js';
import { SeededRandom } from '../utils.js';
import { DrifterEntity } from './DrifterEntity.js';

export class DrifterRoster {
  private roster: Drifter[] = [];
  private rng: SeededRandom;

  constructor(seed: number) {
    this.rng = new SeededRandom(seed);
  }

  public addSurvivor(drifter: Drifter): void {
    const exists = this.roster.some((entry) => entry.id === drifter.id);
    if (exists) {
      return;
    }
    this.roster.push(this.cloneDrifter(drifter));
  }

  public drawDrifter(runID: RunID, currentZone: ZoneID, position: Vector2): DrifterEntity {
    const shouldReuse = this.roster.length > 0 && this.rng.next() <= 0.2;
    if (shouldReuse) {
      const candidate = this.cloneDrifter(this.rng.pick(this.roster));
      return DrifterEntity.createFromRoster(candidate, runID, currentZone, position);
    }

    return DrifterEntity.createFresh(runID, currentZone, position);
  }

  public listSurvivors(): Drifter[] {
    return this.roster.map((entry) => this.cloneDrifter(entry));
  }

  private cloneDrifter(drifter: Drifter): Drifter {
    return JSON.parse(JSON.stringify(drifter)) as Drifter;
  }
}
