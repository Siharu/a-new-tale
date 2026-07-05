import { Direction, } from '../types.js';
import { ID, SeededRandom } from '../utils.js';
const DRIFTER_NAMES = [
    'Som',
    'Anika',
    'Mina',
    'Rafi',
    'Kaito',
    'Jun',
    'Tara',
    'Nila',
    'Rina',
    'Hiro',
];
export class DrifterEntity {
    constructor(drifter, _seed) {
        this.drifter = drifter;
    }
    static createFresh(runID, currentZone, position, origin = 'Unknown') {
        const id = ID.create('drifter');
        const seed = Date.now() ^ Math.floor(Math.random() * 0xffffff);
        const drifter = {
            id,
            name: DrifterEntity.generateName(seed),
            origin,
            appearance: DrifterEntity.generateAppearance(seed),
            position: { x: position.x, y: position.y },
            facing: Direction.S,
            currentZone,
            currentBuilding: null,
            currentRoom: null,
            health: 100,
            signalStrength: 100,
            airQuality: 100,
            inventory: [],
            maxInventory: 10,
            logbook: [],
            evidenceChains: [],
            drifterSeed: seed,
            runID,
            timeAlive: 0,
        };
        return new DrifterEntity(drifter, seed);
    }
    static createFromRoster(existing, runID, currentZone, position) {
        const seed = Date.now() ^ Math.floor(Math.random() * 0xffffff);
        const drifter = {
            ...existing,
            id: ID.create('drifter'),
            position: { x: position.x, y: position.y },
            currentZone,
            currentBuilding: null,
            currentRoom: null,
            health: 100,
            signalStrength: 100,
            airQuality: 100,
            inventory: [],
            logbook: [],
            evidenceChains: [],
            drifterSeed: seed,
            runID,
            timeAlive: 0,
        };
        return new DrifterEntity(drifter, seed);
    }
    static generateName(seed) {
        const rng = new SeededRandom(seed);
        return rng.pick(DRIFTER_NAMES);
    }
    static generateAppearance(seed) {
        const rng = new SeededRandom(seed + 1);
        return {
            variant: rng.nextInt(1, 3),
            emotion: rng.pick(['neutral', 'watchful', 'wary', 'tired', 'steady']),
        };
    }
    updateTimeAlive(seconds) {
        this.drifter.timeAlive += Math.max(0, seconds);
    }
    setFacing(direction) {
        this.drifter.facing = direction;
    }
    setFacingFromDelta(delta) {
        if (Math.abs(delta.x) > Math.abs(delta.y)) {
            this.drifter.facing = delta.x > 0 ? Direction.E : Direction.W;
        }
        else if (Math.abs(delta.y) > 0) {
            this.drifter.facing = delta.y > 0 ? Direction.S : Direction.N;
        }
    }
    applyDamage(amount) {
        this.drifter.health = Math.max(0, this.drifter.health - Math.max(0, amount));
    }
    heal(amount) {
        this.drifter.health = Math.min(100, this.drifter.health + Math.max(0, amount));
    }
    canCarry(_item) {
        return this.drifter.inventory.length < this.drifter.maxInventory;
    }
    pickUp(item) {
        if (!this.canCarry(item)) {
            return false;
        }
        this.drifter.inventory.push(item);
        return true;
    }
    addLogbookEntry(entry) {
        this.drifter.logbook.push(entry);
    }
    updateOrigin(origin) {
        this.drifter.origin = origin;
    }
    setLocation(position, currentZone, currentBuilding = null, currentRoom = null) {
        this.drifter.position = { x: position.x, y: position.y };
        this.drifter.currentZone = currentZone;
        this.drifter.currentBuilding = currentBuilding;
        this.drifter.currentRoom = currentRoom;
    }
}
//# sourceMappingURL=DrifterEntity.js.map