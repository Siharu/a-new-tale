import type { ZoneType } from '../types.js';
import { ID } from '../utils.js';

export interface WorldInfoDeposit {
  id: string;
  zoneType: ZoneType;
  region: string;
  position: { x: number; y: number };
  text: string;
  tags: string[];
  createdAt: number;
  originRunID: string;
}

export interface WorldInfoLayerOptions {
  storageKey?: string;
  initialDeposits?: WorldInfoDeposit[];
}

const STORAGE_KEY_DEFAULT = 'drifter_world_info_layer';

export class WorldInfoLayer {
  private storageKey: string;
  private deposits: WorldInfoDeposit[] = [];

  constructor(options: WorldInfoLayerOptions = {}) {
    this.storageKey = options.storageKey ?? STORAGE_KEY_DEFAULT;
    this.deposits = options.initialDeposits ? [...options.initialDeposits] : [];
    this.load();
  }

  public addDeposit(deposit: Omit<WorldInfoDeposit, 'id' | 'createdAt'>): WorldInfoDeposit {
    const record: WorldInfoDeposit = {
      ...deposit,
      id: ID.create<string>('world-info-deposit'),
      createdAt: Date.now(),
    };
    this.deposits.push(record);
    this.save();
    return record;
  }

  public getDepositsForZone(zoneType: ZoneType, region?: string): WorldInfoDeposit[] {
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

  public listAllDeposits(): WorldInfoDeposit[] {
    return [...this.deposits];
  }

  public clearDeposits(): void {
    this.deposits = [];
    this.save();
  }

  public importDeposits(deposits: WorldInfoDeposit[]): void {
    this.deposits.push(...deposits);
    this.save();
  }

  private load(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as WorldInfoDeposit[];
      this.deposits = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.deposits = [];
    }
  }

  private save(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.deposits));
    } catch {
      // ignore storage failures
    }
  }
}
