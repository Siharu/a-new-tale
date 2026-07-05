import { Interactable, Item, LogbookEntry, Vector2, Weapon } from '../types.js';
export declare class CatalogSystem {
    createEntryForItem(drifterSeed: number, item: Item | Weapon, _position: Vector2): LogbookEntry;
    createEntryForInteractable(drifterSeed: number, interactable: Interactable, position: Vector2): LogbookEntry;
    createEntryForStoryHook(drifterSeed: number, hookTitle: string, hookDescription: string, _position: Vector2): LogbookEntry;
}
//# sourceMappingURL=CatalogSystem.d.ts.map