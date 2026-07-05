import { Direction } from '../types.js';
import type { BuildingID, Drifter, DrifterAppearance, Item, LogbookEntry, RunID, RoomID, Vector2, Weapon, ZoneID } from '../types.js';
export declare class DrifterEntity {
    drifter: Drifter;
    private constructor();
    static createFresh(runID: RunID, currentZone: ZoneID, position: Vector2, origin?: string): DrifterEntity;
    static createFromRoster(existing: Drifter, runID: RunID, currentZone: ZoneID, position: Vector2): DrifterEntity;
    static generateName(seed: number): string;
    static generateAppearance(seed: number): DrifterAppearance;
    updateTimeAlive(seconds: number): void;
    setFacing(direction: Direction): void;
    setFacingFromDelta(delta: Vector2): void;
    applyDamage(amount: number): void;
    heal(amount: number): void;
    canCarry(_item: Item | Weapon): boolean;
    pickUp(item: Item | Weapon): boolean;
    addLogbookEntry(entry: LogbookEntry): void;
    updateOrigin(origin: string): void;
    setLocation(position: Vector2, currentZone: ZoneID, currentBuilding?: BuildingID | null, currentRoom?: RoomID | null): void;
}
//# sourceMappingURL=DrifterEntity.d.ts.map