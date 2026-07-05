/**
 * WORLD GENERATOR
 * Procedurally generates zones, buildings, rooms, hazards, content
 */
import { type Zone, type Building, type Room, type Vector2, type WorldGenOptions, type ZoneID, type BuildingID, type RoomID } from './types.js';
export declare class WorldGenerator {
    private seed;
    private rng;
    private options;
    private zones;
    private buildings;
    private rooms;
    constructor(options: WorldGenOptions);
    /**
     * Generate entire world
     */
    generate(): {
        zones: Zone[];
        hqPosition: Vector2;
    };
    /**
     * Generate zone grid positions
     * Layout: sqrt(count) × sqrt(count) grid
     */
    private generateZoneGrid;
    /**
     * Generate single zone
     */
    private generateZone;
    /**
     * Generate single building
     */
    private generateBuilding;
    /**
     * Generate single room
     */
    private generateRoom;
    /**
     * Generate item (chance to be weapon)
     */
    private generateItem;
    /**
     * Generate room hazard (husk nest, anomaly, etc)
     */
    private generateRoomHazard;
    /**
     * Generate building-level hazards
     */
    private generateBuildingHazards;
    /**
     * Generate environmental hazards (zone-wide anomalies)
     */
    private generateEnvironmentalHazards;
    /**
     * Generate interactables in room (doors, investigation points, etc)
     */
    private generateInteractables;
    /**
     * Generate collision grid for building
     */
    private generateCollisionGrid;
    /**
     * Select zone type based on difficulty/seed
     */
    private selectZoneType;
    /**
     * Select building type
     */
    private selectBuildingType;
    /**
     * Generate zone name
     */
    private generateZoneName;
    /**
     * Generate building name
     */
    private generateBuildingName;
    /**
     * Calculate decay level based on zone type and difficulty
     */
    private calculateDecayLevel;
    /**
     * Get zone by ID
     */
    getZone(id: ZoneID): Zone | undefined;
    /**
     * Get building by ID
     */
    getBuilding(id: BuildingID): Building | undefined;
    /**
     * Get room by ID
     */
    getRoom(id: RoomID): Room | undefined;
    /**
     * Get all zones
     */
    getAllZones(): Zone[];
}
//# sourceMappingURL=worldgen.d.ts.map