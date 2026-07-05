import { RunStatus } from '../types.js';
import { ID } from '../utils.js';
export var RunPhase;
(function (RunPhase) {
    RunPhase["HQ"] = "HQ";
    RunPhase["EXPLORATION"] = "EXPLORATION";
    RunPhase["RESOLUTION"] = "RESOLUTION";
})(RunPhase || (RunPhase = {}));
export class RunManager {
    constructor(options) {
        this.currentRun = null;
        this.history = [];
        this.options = options;
    }
    startRun(drifter, zone) {
        const run = {
            id: ID.create('run'),
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
    recordResource(item) {
        if (!this.currentRun) {
            return;
        }
        if (typeof item === 'object' && item !== null) {
            this.currentRun.resourcesCollected.push(item);
        }
    }
    recordLogbookEntry(entry) {
        if (!this.currentRun) {
            return;
        }
        if (typeof entry === 'object' && entry !== null) {
            this.currentRun.logbookFinal.push(entry);
        }
    }
    recordDeduction(entry) {
        if (!this.currentRun) {
            return;
        }
        if (typeof entry === 'object' && entry !== null) {
            this.currentRun.deductionsMade.push(entry);
        }
    }
    failRun(causeOfDeath) {
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
    completeRun() {
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
    getCurrentRun() {
        return this.currentRun;
    }
    getHistory() {
        return [...this.history];
    }
    clearHistory() {
        this.history.length = 0;
    }
    storeSummary() {
        if (!this.currentRun) {
            return;
        }
        const duration = this.currentRun.endTime
            ? this.currentRun.endTime - this.currentRun.startTime
            : 0;
        const summary = {
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
//# sourceMappingURL=RunManager.js.map