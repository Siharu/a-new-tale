import type { Drifter, Item, Weapon } from '../types.js';

export class InventorySystem {
  public getWeight(drifter: Drifter): number {
    return drifter.inventory.reduce((total, item) => total + item.weight, 0);
  }

  public canAddItem(drifter: Drifter, item: Item | Weapon): boolean {
    if (drifter.inventory.length >= drifter.maxInventory) {
      return false;
    }
    return this.getWeight(drifter) + item.weight <= this.getMaxCarryWeight(drifter);
  }

  public getMaxCarryWeight(drifter: Drifter): number {
    return drifter.maxInventory * 5;
  }

  public addItem(drifter: Drifter, item: Item | Weapon): boolean {
    if (!this.canAddItem(drifter, item)) {
      return false;
    }
    drifter.inventory.push(item);
    return true;
  }

  public removeItem(drifter: Drifter, itemID: string): Item | Weapon | null {
    const index = drifter.inventory.findIndex((entry) => entry.id === itemID);
    if (index === -1) {
      return null;
    }
    return drifter.inventory.splice(index, 1)[0] ?? null;
  }

  public hasItem(drifter: Drifter, itemID: string): boolean {
    return drifter.inventory.some((entry) => entry.id === itemID);
  }

  public clearInventory(drifter: Drifter): void {
    drifter.inventory.length = 0;
  }
}
