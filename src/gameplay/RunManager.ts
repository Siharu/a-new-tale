import { Drifter, Run, RunID, RunStatus, RunSummary, Vector2, Zone } from '../types.js';
import { ID } from '../utils.js';

export enum RunPhase {
  HQ = 'HQ',
  EXPLORATION = 'EXPLORATION',
  RESOLUTION = 'RESOLUTION',
}

export interface RunManagerOptions {
  seed: number;
  hqPosition: Vector2;
  maxHistory?: number;
}

export class RunManager {
  private currentRun: Run | null = null;
  private history: RunSummary[] = [];
  private options: RunManagerOptions;

  constructor(options: RunManagerOptions) {
    this.options = options;
  }

  public startRun(drifter: Drifter, zone: Zone): Run {
    const run: Run = {
      id: ID.create<RunID>('run'),
      drifter,
      startTime: Date.now(),
      endTime: null,
      worldSeed: this.options.seed,
      worldTimeOfDay: zone.timeOfDay,
      resourcesCollected: [],
      logbookFinal: [],
      deductionsMade: [],
      status: RunStatus.ACTIVE,
    };
    this.currentRun = run;
    return run;
  }

  public recordResource(item: unknown): void {
    if (!this.currentRun) {
      return;
    }
    if (typeof item === 'object' && item !== null) {
      this.currentRun.resourcesCollected.push(item as any);
    }
  }

  public recordLogbookEntry(entry: unknown): void {
    if (!this.currentRun) {
      return;
    }
    if (typeof entry === 'object' && entry !== null) {
      this.currentRun.logbookFinal.push(entry as any);
    }
  }

  public recordDeduction(entry: unknown): void {
    if (!this.currentRun) {
      return;
    }
    if (typeof entry === 'object' && entry !== null) {
      this.currentRun.deductionsMade.push(entry as any);
    }
  }

  public failRun(causeOfDeath: string): Run | null {
    if (!this.currentRun) {
      return null;
    }
    this.currentRun.status = RunStatus.DEATH;
    this.currentRun.causeOfDeath = causeOfDeath;
    this.currentRun.endTime = Date.now();
    this.storeSummary();
    const completed = this.currentRun;
    this.currentRun = null;
    return completed;
  }

  public completeRun(): Run | null {
    if (!this.currentRun) {
      return null;
    }
    this.currentRun.status = RunStatus.SUCCESS;
    this.currentRun.endTime = Date.now();
    this.storeSummary();
    const completed = this.currentRun;
    this.currentRun = null;
    return completed;
  }

  public getCurrentRun(): Run | null {
    return this.currentRun;
  }

  public getHistory(): RunSummary[] {
    return [...this.history];
  }

  public clearHistory(): void {
    this.history.length = 0;
  }

  private storeSummary(): void {
    if (!this.currentRun) {
      return;
    }

    const duration = this.currentRun.endTime
      ? this.currentRun.endTime - this.currentRun.startTime
      : 0;

    const summary: RunSummary = {
      runID: this.currentRun.id,
      drifterName: this.currentRun.drifter.name,
      duration,
      resourcesExtracted: this.currentRun.resourcesCollected.length,
      deductionsMade: this.currentRun.deductionsMade.length,
      status: this.currentRun.status,
      causeOfDeath: this.currentRun.causeOfDeath,
      timestamp: this.currentRun.endTime ?? Date.now(),
    };

    this.history.unshift(summary);
    if (this.options.maxHistory && this.history.length > this.options.maxHistory) {
      this.history.length = this.options.maxHistory;
    }
  }
}
