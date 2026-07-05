import { ID } from '../utils.js';
const STORAGE_KEY_DEFAULT = 'drifter_world_info_layer';
export class WorldInfoLayer {
    constructor(options = {}) {
        this.deposits = [];
        this.storageKey = options.storageKey ?? STORAGE_KEY_DEFAULT;
        this.deposits = options.initialDeposits ? [...options.initialDeposits] : [];
        this.load();
    }
    addDeposit(deposit) {
        const record = {
            ...deposit,
            id: ID.create('world-info-deposit'),
            createdAt: Date.now(),
        };
        this.deposits.push(record);
        this.save();
        return record;
    }
    getDepositsForZone(zoneType, region) {
        return this.deposits.filter((entry) => {
            if (entry.zoneType !== zoneType) {
                return false;
            }
            if (region && entry.region !== region) {
                return false;
            }
            return true;
        });
    }
    listAllDeposits() {
        return [...this.deposits];
    }
    clearDeposits() {
        this.deposits = [];
        this.save();
    }
    importDeposits(deposits) {
        this.deposits.push(...deposits);
        this.save();
    }
    load() {
        if (typeof localStorage === 'undefined') {
            return;
        }
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) {
                return;
            }
            const parsed = JSON.parse(raw);
            this.deposits = Array.isArray(parsed) ? parsed : [];
        }
        catch {
            this.deposits = [];
        }
    }
    save() {
        if (typeof localStorage === 'undefined') {
            return;
        }
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.deposits));
        }
        catch {
            // ignore storage failures
        }
    }
}
//# sourceMappingURL=WorldInfoLayer.js.map