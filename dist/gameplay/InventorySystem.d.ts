import type { Drifter, Item, Weapon } from '../types.js';
export declare class InventorySystem {
    getWeight(drifter: Drifter): number;
    canAddItem(drifter: Drifter, item: Item | Weapon): boolean;
    getMaxCarryWeight(drifter: Drifter): number;
    addItem(drifter: Drifter, item: Item | Weapon): boolean;
    removeItem(drifter: Drifter, itemID: string): Item | Weapon | null;
    hasItem(drifter: Drifter, itemID: string): boolean;
    clearInventory(drifter: Drifter): void;
}
//# sourceMappingURL=InventorySystem.d.ts.map