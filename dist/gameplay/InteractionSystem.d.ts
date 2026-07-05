import type { Building, Drifter, Hazard, Interactable, Item, LogbookEntry, StoryHook, Vector2, Weapon } from '../types.js';
export interface InteractionContext {
    drifter: Drifter;
    zoneBuilding: Building | null;
    nearbyItems: Item[];
    nearbyWeapons: Weapon[];
    nearbyInteractables: Interactable[];
    nearbyStoryHooks: StoryHook[];
    hazards: Hazard[];
}
export declare class InteractionSystem {
    private catalog;
    private interactionRadius;
    constructor(interactionRadius?: number);
    findClosestInteractable(drifterPosition: Vector2, interactables: Interactable[]): Interactable | null;
    interactWithItem(drifter: Drifter, item: Item | Weapon): LogbookEntry;
    interactWithInteractable(drifter: Drifter, interactable: Interactable): LogbookEntry;
    interactWithStoryHook(drifter: Drifter, hook: StoryHook): LogbookEntry;
    collectNearbyItems(drifter: Drifter, items: (Item | Weapon)[]): (Item | Weapon)[];
}
//# sourceMappingURL=InteractionSystem.d.ts.map