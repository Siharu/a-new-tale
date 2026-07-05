import { CatalogSystem } from './CatalogSystem.js';
export class InteractionSystem {
    constructor(interactionRadius = 64) {
        this.catalog = new CatalogSystem();
        this.interactionRadius = interactionRadius;
    }
    findClosestInteractable(drifterPosition, interactables) {
        let closest = null;
        let bestDistance = Infinity;
        for (const interactable of interactables) {
            const dx = interactable.position.x - drifterPosition.x;
            const dy = interactable.position.y - drifterPosition.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= this.interactionRadius && distance < bestDistance) {
                closest = interactable;
                bestDistance = distance;
            }
        }
        return closest;
    }
    interactWithItem(drifter, item) {
        const entry = this.catalog.createEntryForItem(drifter.drifterSeed, item, item.position);
        drifter.inventory.push(item);
        return entry;
    }
    interactWithInteractable(drifter, interactable) {
        const entry = this.catalog.createEntryForInteractable(drifter.drifterSeed, interactable, interactable.position);
        interactable.investigated = true;
        return entry;
    }
    interactWithStoryHook(drifter, hook) {
        const entry = this.catalog.createEntryForStoryHook(drifter.drifterSeed, hook.name, hook.description, hook.position);
        return entry;
    }
    collectNearbyItems(drifter, items) {
        return items.filter((item) => {
            const dx = item.position.x - drifter.position.x;
            const dy = item.position.y - drifter.position.y;
            return Math.sqrt(dx * dx + dy * dy) <= this.interactionRadius;
        });
    }
}
//# sourceMappingURL=InteractionSystem.js.map