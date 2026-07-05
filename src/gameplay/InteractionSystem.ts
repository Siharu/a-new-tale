import type {
  Building,
  Drifter,
  Hazard,
  Interactable,
  Item,
  LogbookEntry,
  StoryHook,
  Vector2,
  Weapon,
} from '../types.js';
import { CatalogSystem } from './CatalogSystem.js';

export interface InteractionContext {
  drifter: Drifter;
  zoneBuilding: Building | null;
  nearbyItems: Item[];
  nearbyWeapons: Weapon[];
  nearbyInteractables: Interactable[];
  nearbyStoryHooks: StoryHook[];
  hazards: Hazard[];
}

export class InteractionSystem {
  private catalog: CatalogSystem;
  private interactionRadius: number;

  constructor(interactionRadius: number = 64) {
    this.catalog = new CatalogSystem();
    this.interactionRadius = interactionRadius;
  }

  public findClosestInteractable(
    drifterPosition: Vector2,
    interactables: Interactable[]
  ): Interactable | null {
    let closest: Interactable | null = null;
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

  public interactWithItem(
    drifter: Drifter,
    item: Item | Weapon
  ): LogbookEntry {
    const entry = this.catalog.createEntryForItem(drifter.drifterSeed, item, item.position);
    drifter.inventory.push(item);
    return entry;
  }

  public interactWithInteractable(
    drifter: Drifter,
    interactable: Interactable
  ): LogbookEntry {
    const entry = this.catalog.createEntryForInteractable(drifter.drifterSeed, interactable, interactable.position);
    interactable.investigated = true;
    return entry;
  }

  public interactWithStoryHook(
    drifter: Drifter,
    hook: StoryHook
  ): LogbookEntry {
    const entry = this.catalog.createEntryForStoryHook(
      drifter.drifterSeed,
      hook.name,
      hook.description,
      hook.position
    );
    return entry;
  }

  public collectNearbyItems(
    drifter: Drifter,
    items: (Item | Weapon)[]
  ): (Item | Weapon)[] {
    return items.filter((item) => {
      const dx = item.position.x - drifter.position.x;
      const dy = item.position.y - drifter.position.y;
      return Math.sqrt(dx * dx + dy * dy) <= this.interactionRadius;
    });
  }
}
