/**
 * WORLD GENERATOR
 * Procedurally generates zones, buildings, rooms, hazards, content
 */
import { ZoneType, BuildingType, RoomType, WeatherType, HazardType, InteractableType, WrongnessState, } from './types.js';
import { SeededRandom, ID, valueNoise2D } from './utils.js';
export class WorldGenerator {
    constructor(options) {
        // Caches (avoid regenerating)
        this.zones = new Map();
        this.buildings = new Map();
        this.rooms = new Map();
        this.options = options;
        this.seed = options.seed;
        this.rng = new SeededRandom(this.seed);
    }
    /**
     * Generate entire world
     */
    generate() {
        const zones = [];
        const hqPosition = this.options.hqPosition || { x: 256, y: 256 };
        // Generate zone grid layout
        const zoneGrid = this.generateZoneGrid(this.options.zoneCount);
        for (const zonePos of zoneGrid) {
            const zone = this.generateZone(zonePos);
            zones.push(zone);
            this.zones.set(zone.id, zone);
        }
        return { zones, hqPosition };
    }
    /**
     * Generate zone grid positions
     * Layout: sqrt(count) × sqrt(count) grid
     */
    generateZoneGrid(count) {
        const gridSize = Math.ceil(Math.sqrt(count));
        const zoneSize = 2048; // World units per zone
        const positions = [];
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                if (positions.length >= count)
                    break;
                positions.push({
                    x: i * zoneSize,
                    y: j * zoneSize,
                });
            }
            if (positions.length >= count)
                break;
        }
        return positions;
    }
    /**
     * Generate single zone
     */
    generateZone(position) {
        const zoneSeed = this.rng.nextInt(0, 1000000);
        const zoneRng = new SeededRandom(zoneSeed);
        const zoneID = ID.create(`zone-${position.x}-${position.y}`);
        const zoneType = this.selectZoneType(zoneRng);
        const weatherState = zoneRng.pick(Object.values(WeatherType));
        // Generate buildings for this zone
        const buildingCount = zoneRng.nextInt(8, 12);
        const buildings = [];
        const hazards = [];
        const items = [];
        const storyHooks = [];
        for (let i = 0; i < buildingCount; i++) {
            const buildingPos = {
                x: position.x + zoneRng.nextFloat(100, 1900),
                y: position.y + zoneRng.nextFloat(100, 1900),
            };
            const building = this.generateBuilding(buildingPos, zoneRng);
            buildings.push(building);
            this.buildings.set(building.id, building);
            // Extract building's items and hazards
            items.push(...building.items);
            hazards.push(...building.hazards);
            storyHooks.push(...building.storyHooks);
        }
        // Generate environmental hazards
        const envHazards = this.generateEnvironmentalHazards(zoneID, position, zoneRng);
        hazards.push(...envHazards);
        const zone = {
            id: zoneID,
            name: this.generateZoneName(zoneType, zoneRng),
            type: zoneType,
            position,
            size: { width: 2048, height: 2048 },
            seed: zoneSeed,
            timeOfDay: zoneRng.nextFloat(0, 24),
            weatherState,
            fogIntensity: valueNoise2D(position.x, position.y, zoneSeed) * 0.8,
            decayLevel: this.calculateDecayLevel(zoneType, this.options.difficulty),
            // Randomly pick from the four visually safe states so the scene is
            // always readable. High-wrongness states (STORMY, DIFFERENT, ANOTHER_SKY)
            // drive ambient+fog so dark that only emissive fragments survive — they
            // can be reintroduced once the renderer has a proper visibility floor.
            wrongnessState: zoneRng.pick([
                WrongnessState.SUNNY,
                WrongnessState.BLUE,
                WrongnessState.GREY,
                WrongnessState.RAINY,
            ]),
            region: `Region-${zoneID.slice(0, 8)}`,
            buildings,
            hazards,
            storyHooks,
            items,
            hqEntrance: null, // Set separately if needed
        };
        return zone;
    }
    /**
     * Generate single building
     */
    generateBuilding(position, rng) {
        const buildingID = ID.create('building');
        const buildingSeed = rng.nextInt(0, 1000000); // deterministic — drawn
        // from this zone's RNG stream, unlike buildingID (which uses
        // Date.now()+Math.random() for uniqueness and is NOT reproducible
        // across runs). SVGBuildingFactory must seed its facade RNG from
        // this field, not from hashing buildingID.
        const buildingType = this.selectBuildingType(rng);
        const roomCount = rng.nextInt(4, 8);
        const rooms = [];
        const items = [];
        const hazards = [];
        const storyHooks = [];
        const interactables = [];
        // Generate rooms for building
        for (let i = 0; i < roomCount; i++) {
            const roomPos = {
                x: i % 2,
                y: Math.floor(i / 2),
            };
            const room = this.generateRoom(buildingID, roomPos, rng);
            rooms.push(room);
            this.rooms.set(room.id, room);
            // Aggregate room content
            items.push(...room.items);
            hazards.push(...room.hazards);
            interactables.push(...room.interactables);
        }
        // Generate building-level hazards
        const buildingHazards = this.generateBuildingHazards(buildingID, rng);
        hazards.push(...buildingHazards);
        // Generate collision grid (simplified: blocked cells)
        const collisionGrid = this.generateCollisionGrid(roomCount, rng);
        const building = {
            id: buildingID,
            name: this.generateBuildingName(buildingType, rng),
            type: buildingType,
            position,
            size: { width: 512, height: 512 },
            rooms,
            collisionGrid,
            items,
            hazards,
            storyHooks,
            interactables,
            svgMesh: null, // Assigned by renderer
            decayState: rng.nextFloat(0, 1),
            exploredState: 0,
            seed: buildingSeed,
        };
        return building;
    }
    /**
     * Generate single room
     */
    generateRoom(buildingID, position, rng) {
        const roomID = ID.create('room');
        const roomType = rng.pick(Object.values(RoomType));
        const items = [];
        const hazards = [];
        const interactables = [];
        // Random items in room
        const itemCount = rng.nextInt(1, 5);
        for (let i = 0; i < itemCount; i++) {
            const item = this.generateItem(buildingID, roomID, rng);
            if (item)
                items.push(item);
        }
        // Random hazards in room
        if (rng.next() > 0.7) {
            const hazard = this.generateRoomHazard(roomID, rng);
            hazards.push(hazard);
        }
        // Interactables
        interactables.push(...this.generateInteractables(roomID, roomType, rng));
        const room = {
            id: roomID,
            name: `${roomType} (${position.x}, ${position.y})`,
            position,
            size: { width: 256, height: 256 },
            type: roomType,
            items,
            hazards,
            interactables,
            exploredState: 0,
            decayState: rng.nextFloat(0, 1),
        };
        return room;
    }
    /**
     * Generate item (chance to be weapon)
     */
    generateItem(buildingID, roomID, rng) {
        const isWeapon = rng.next() > 0.8;
        const iconIndex = rng.nextInt(1, isWeapon ? 20 : 100);
        const item = {
            id: ID.create('item'),
            name: isWeapon ? `Weapon #${iconIndex}` : `Item #${iconIndex}`,
            description: 'Evidence of the world before.',
            iconIndex,
            isWeapon: false,
            value: rng.nextInt(1, 50),
            weight: rng.nextFloat(0.5, 5),
            position: { x: rng.nextFloat(0, 256), y: rng.nextFloat(0, 256) },
            buildingID,
            roomID,
        };
        return item;
    }
    /**
     * Generate room hazard (husk nest, anomaly, etc)
     */
    generateRoomHazard(_roomID, rng) {
        const hazardType = rng.pick([
            HazardType.HUSK_NEST,
            HazardType.FOG_POCKET,
            HazardType.STRUCTURAL_DECAY,
        ]);
        const hazard = {
            id: ID.create('hazard'),
            type: hazardType,
            position: { x: rng.nextFloat(50, 200), y: rng.nextFloat(50, 200) },
            radius: rng.nextFloat(30, 100),
            intensity: rng.nextFloat(0.3, 1),
            spawnTime: rng.nextFloat(0, 24),
            maxIntensity: rng.nextFloat(0.5, 1),
            rampSpeed: rng.nextFloat(0.1, 0.5),
            zoneID: 'zone-0-0', // Updated during zone generation
            buildingID: null,
        };
        return hazard;
    }
    /**
     * Generate building-level hazards
     */
    generateBuildingHazards(buildingID, rng) {
        const hazards = [];
        const hazardCount = rng.nextInt(0, 2);
        for (let i = 0; i < hazardCount; i++) {
            const hazard = {
                id: ID.create('hazard'),
                type: HazardType.STRUCTURAL_DECAY,
                position: {
                    x: rng.nextFloat(50, 450),
                    y: rng.nextFloat(50, 450),
                },
                radius: rng.nextFloat(50, 150),
                intensity: rng.nextFloat(0.2, 0.7),
                spawnTime: 0,
                maxIntensity: 1,
                rampSpeed: 0.1,
                zoneID: 'zone-0-0',
                buildingID,
            };
            hazards.push(hazard);
        }
        return hazards;
    }
    /**
     * Generate environmental hazards (zone-wide anomalies)
     */
    generateEnvironmentalHazards(zoneID, zonePos, rng) {
        const hazards = [];
        // Fog pockets
        if (rng.next() > 0.5) {
            const fogCount = rng.nextInt(1, 3);
            for (let i = 0; i < fogCount; i++) {
                hazards.push({
                    id: ID.create('hazard'),
                    type: HazardType.FOG_POCKET,
                    position: {
                        x: zonePos.x + rng.nextFloat(200, 1800),
                        y: zonePos.y + rng.nextFloat(200, 1800),
                    },
                    radius: rng.nextFloat(200, 400),
                    intensity: rng.nextFloat(0.4, 1),
                    spawnTime: rng.nextFloat(0, 12),
                    maxIntensity: 1,
                    rampSpeed: 0.05,
                    zoneID,
                    buildingID: null,
                });
            }
        }
        // Anomalies
        if (rng.next() > 0.7) {
            hazards.push({
                id: ID.create('hazard'),
                type: HazardType.ANOMALY,
                position: {
                    x: zonePos.x + rng.nextFloat(600, 1400),
                    y: zonePos.y + rng.nextFloat(600, 1400),
                },
                radius: rng.nextFloat(100, 300),
                intensity: rng.nextFloat(0.5, 1),
                spawnTime: 0,
                maxIntensity: 1,
                rampSpeed: 0.2,
                zoneID,
                buildingID: null,
            });
        }
        return hazards;
    }
    /**
     * Generate interactables in room (doors, investigation points, etc)
     */
    generateInteractables(_roomID, roomType, rng) {
        const interactables = [];
        // Always a door
        interactables.push({
            id: ID.create('interactable'),
            type: InteractableType.DOOR,
            position: { x: rng.nextFloat(0, 256), y: rng.nextFloat(0, 256) },
            investigated: false,
        });
        // Investigation points in certain rooms
        if ([RoomType.ARCHIVE, RoomType.OFFICE, RoomType.SERVER_ROOM].includes(roomType)) {
            if (rng.next() > 0.5) {
                interactables.push({
                    id: ID.create('interactable'),
                    type: InteractableType.INVESTIGATION_POINT,
                    position: {
                        x: rng.nextFloat(50, 200),
                        y: rng.nextFloat(50, 200),
                    },
                    investigated: false,
                });
            }
        }
        return interactables;
    }
    /**
     * Generate collision grid for building
     */
    generateCollisionGrid(_roomCount, rng) {
        const size = 8; // 8×8 grid
        const grid = Array(size)
            .fill(null)
            .map(() => Array(size).fill(false));
        // Randomly block some cells
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                if (rng.next() > 0.7) {
                    grid[i][j] = true; // Blocked
                }
            }
        }
        return grid;
    }
    /**
     * Select zone type based on difficulty/seed
     */
    selectZoneType(rng) {
        const types = Object.values(ZoneType);
        return rng.pick(types);
    }
    /**
     * Select building type
     */
    selectBuildingType(rng) {
        const types = Object.values(BuildingType);
        return rng.pick(types);
    }
    /**
     * Generate zone name
     */
    generateZoneName(type, rng) {
        const adjectives = [
            'Decayed',
            'Forgotten',
            'Silent',
            'Lost',
            'Haunted',
            'Ravaged',
            'Empty',
        ];
        const nouns = [
            'District',
            'Quarter',
            'Zone',
            'Sector',
            'Area',
            'Expanse',
            'Wastes',
        ];
        const adj = rng.pick(adjectives);
        const noun = rng.pick(nouns);
        return `${adj} ${type} ${noun}`;
    }
    /**
     * Generate building name
     */
    generateBuildingName(type, rng) {
        const prefixes = [
            'Old',
            'Rusted',
            'Abandoned',
            'Former',
            'Derelict',
        ];
        const prefix = rng.pick(prefixes);
        return `${prefix} ${type}`;
    }
    /**
     * Calculate decay level based on zone type and difficulty
     */
    calculateDecayLevel(zoneType, difficulty) {
        const base = difficulty / 10;
        const typeModifier = zoneType === ZoneType.RUINS ? 1.0 : 0.7;
        return Math.min(base * typeModifier, 1);
    }
    /**
     * Get zone by ID
     */
    getZone(id) {
        return this.zones.get(id);
    }
    /**
     * Get building by ID
     */
    getBuilding(id) {
        return this.buildings.get(id);
    }
    /**
     * Get room by ID
     */
    getRoom(id) {
        return this.rooms.get(id);
    }
    /**
     * Get all zones
     */
    getAllZones() {
        return Array.from(this.zones.values());
    }
}
//# sourceMappingURL=worldgen.js.map