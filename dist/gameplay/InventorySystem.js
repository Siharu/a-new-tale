export class InventorySystem {
    getWeight(drifter) {
        return drifter.inventory.reduce((total, item) => total + item.weight, 0);
    }
    canAddItem(drifter, item) {
        if (drifter.inventory.length >= drifter.maxInventory) {
            return false;
        }
        return this.getWeight(drifter) + item.weight <= this.getMaxCarryWeight(drifter);
    }
    getMaxCarryWeight(drifter) {
        return drifter.maxInventory * 5;
    }
    addItem(drifter, item) {
        if (!this.canAddItem(drifter, item)) {
            return false;
        }
        drifter.inventory.push(item);
        return true;
    }
    removeItem(drifter, itemID) {
        const index = drifter.inventory.findIndex((entry) => entry.id === itemID);
        if (index === -1) {
            return null;
        }
        return drifter.inventory.splice(index, 1)[0] ?? null;
    }
    hasItem(drifter, itemID) {
        return drifter.inventory.some((entry) => entry.id === itemID);
    }
    clearInventory(drifter) {
        drifter.inventory.length = 0;
    }
}
//# sourceMappingURL=InventorySystem.js.map