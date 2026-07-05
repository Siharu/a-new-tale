import {
  EntryID,
  Interactable,
  Item,
  LogbookEntry,
  LogbookEntryType,
  Vector2,
  Weapon,
} from '../types.js';
import { ID } from '../utils.js';
import { FactPoolKey, pullFactFromPool } from '../data/fact_pools.js';

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
}

function resolvePoolForItem(item: Item | Weapon): FactPoolKey {
  if (item.isWeapon) {
    return 'technical';
  }

  const lower = item.name.toLowerCase();
  if (lower.includes('photo') || lower.includes('surveillance')) {
    return 'photo';
  }
  if (lower.includes('radio') || lower.includes('broadcast') || lower.includes('signal')) {
    return 'broadcast';
  }
  if (lower.includes('note') || lower.includes('journal') || lower.includes('document')) {
    return 'document';
  }
  if (lower.includes('currency') || lower.includes('med') || lower.includes('water') || lower.includes('food')) {
    return 'supply';
  }
  return 'personal';
}

function resolvePoolForInteractable(interactable: Interactable): FactPoolKey {
  switch (interactable.type) {
    case 'INVESTIGATION_POINT':
      return 'personal';
    case 'ANOMALY':
      return 'specialized';
    case 'HQ_ENTRANCE':
      return 'broadcast';
    case 'DOOR':
      return 'document';
    case 'ITEM':
    default:
      return 'personal';
  }
}

export class CatalogSystem {
  public createEntryForItem(
    drifterSeed: number,
    item: Item | Weapon,
    _position: Vector2,
  ): LogbookEntry {
    const pool = resolvePoolForItem(item);
    const text = pullFactFromPool(pool, drifterSeed, hashString(item.id));
    const entry: LogbookEntry = {
      id: ID.create<EntryID>('entry'),
      type: LogbookEntryType.ITEM,
      title: `Discovered ${item.name}`,
      text,
      timestamp: Date.now(),
      tags: [item.name, pool],
      relatedEntries: [],
    };
    return entry;
  }

  public createEntryForInteractable(
    drifterSeed: number,
    interactable: Interactable,
    position: Vector2,
  ): LogbookEntry {
    const pool = resolvePoolForInteractable(interactable);
    const baseText = pullFactFromPool(pool, drifterSeed, hashString(interactable.id));
    const entry: LogbookEntry = {
      id: ID.create<EntryID>('entry'),
      type: LogbookEntryType.NOTE,
      title: `Investigated ${interactable.type}`,
      text: `Found ${interactable.type.toLowerCase().replace('_', ' ')} at (${Math.round(position.x)}, ${Math.round(position.y)}). ${baseText}`,
      timestamp: Date.now(),
      tags: [interactable.type, pool],
      relatedEntries: [],
    };
    return entry;
  }

  public createEntryForStoryHook(
    drifterSeed: number,
    hookTitle: string,
    hookDescription: string,
    _position: Vector2,
  ): LogbookEntry {
    const text = pullFactFromPool('specialized', drifterSeed, hashString(hookTitle));
    return {
      id: ID.create<EntryID>('entry'),
      type: LogbookEntryType.DEDUCTION,
      title: `Found story clue: ${hookTitle}`,
      text: `${hookDescription} ${text}`,
      timestamp: Date.now(),
      tags: ['story', 'clue'],
      relatedEntries: [],
    };
  }
}
