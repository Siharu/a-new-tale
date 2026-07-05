/**
 * FACT POOLS — SURVIVOR-PERSPECTIVE CATALOG TEXT
 *
 * Catalog entries written from a Drifter's POV discovering items in the world.
 * All text sourced from lore: Blank Zone, WW3 (2025-2027), currency situation,
 * regional naming, in-world theories (signal rewiring, prions, virus, fungus).
 *
 * Each pool is per-item-type. Drifter picking up the same item type
 * pulls different facts based on region/seed/context (no immediate repeats).
 *
 * ⚠️ CRITICAL: No spoilers. No reference to real mechanism (rejection/veil).
 * Write only what a scared survivor would logically deduce.
 */
export declare const DOCUMENT_FACTS: string[];
export declare const PHOTO_FACTS: string[];
export declare const TECHNICAL_FACTS: string[];
export declare const SUPPLY_FACTS: string[];
export declare const BROADCAST_FACTS: string[];
export declare const PERSONAL_FACTS: string[];
export declare const SPECIALIZED_FACTS: string[];
export type FactPoolKey = 'document' | 'photo' | 'technical' | 'supply' | 'broadcast' | 'personal' | 'specialized';
export declare const FACT_POOLS: Record<FactPoolKey, string[]>;
/**
 * Pull a random fact from a pool, seeded per-Drifter so they don't
 * immediately repeat discoveries. Used by CatalogSystem.
 */
export declare function pullFactFromPool(pool: FactPoolKey, drifterSeed: number, itemSeed: number): string;
//# sourceMappingURL=fact_pools.d.ts.map