import {
  Direction,
} from '../types.js';
import type {
  BuildingID,
  Drifter,
  DrifterAppearance,
  Item,
  LogbookEntry,
  RunID,
  RoomID,
  Vector2,
  Weapon,
  ZoneID,
} from '../types.js';
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
  public drifter: Drifter;

  private constructor(drifter: Drifter, _seed: number) {
    this.drifter = drifter;
  }

  public static createFresh(
    runID: RunID,
    currentZone: ZoneID,
    position: Vector2,
    origin: string = 'Unknown'
  ): DrifterEntity {
    const id = ID.create<Drifter['id']>('drifter');
    const seed = Date.now() ^ Math.floor(Math.random() * 0xffffff);
    const drifter: Drifter = {
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

  public static createFromRoster(
    existing: Drifter,
    runID: RunID,
    currentZone: ZoneID,
    position: Vector2
  ): DrifterEntity {
    const seed = Date.now() ^ Math.floor(Math.random() * 0xffffff);
    const drifter: Drifter = {
      ...existing,
      id: ID.create<Drifter['id']>('drifter'),
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

  public static generateName(seed: number): string {
    const rng = new SeededRandom(seed);
    return rng.pick(DRIFTER_NAMES);
  }

  public static generateAppearance(seed: number): DrifterAppearance {
    const rng = new SeededRandom(seed + 1);
    return {
      variant: rng.nextInt(1, 3),
      emotion: rng.pick(['neutral', 'watchful', 'wary', 'tired', 'steady']),
    };
  }

  public updateTimeAlive(seconds: number): void {
    this.drifter.timeAlive += Math.max(0, seconds);
  }

  public setFacing(direction: Direction): void {
    this.drifter.facing = direction;
  }

  public setFacingFromDelta(delta: Vector2): void {
    if (Math.abs(delta.x) > Math.abs(delta.y)) {
      this.drifter.facing = delta.x > 0 ? Direction.E : Direction.W;
    } else if (Math.abs(delta.y) > 0) {
      this.drifter.facing = delta.y > 0 ? Direction.S : Direction.N;
    }
  }

  public applyDamage(amount: number): void {
    this.drifter.health = Math.max(0, this.drifter.health - Math.max(0, amount));
  }

  public heal(amount: number): void {
    this.drifter.health = Math.min(100, this.drifter.health + Math.max(0, amount));
  }

  public canCarry(_item: Item | Weapon): boolean {
    return this.drifter.inventory.length < this.drifter.maxInventory;
  }

  public pickUp(item: Item | Weapon): boolean {
    if (!this.canCarry(item)) {
      return false;
    }
    this.drifter.inventory.push(item);
    return true;
  }

  public addLogbookEntry(entry: LogbookEntry): void {
    this.drifter.logbook.push(entry);
  }

  public updateOrigin(origin: string): void {
    this.drifter.origin = origin;
  }

  public setLocation(
    position: Vector2,
    currentZone: ZoneID,
    currentBuilding: BuildingID | null = null,
    currentRoom: RoomID | null = null
  ): void {
    this.drifter.position = { x: position.x, y: position.y };
    this.drifter.currentZone = currentZone;
    this.drifter.currentBuilding = currentBuilding;
    this.drifter.currentRoom = currentRoom;
  }
}
