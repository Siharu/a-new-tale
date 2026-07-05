/**
 * WORLD GENERATOR
 * Procedurally generates zones, buildings, rooms, hazards, content
 */

import {
  type Zone,
  type Building,
  type Room,
  type Item,
  type Hazard,
  type StoryHook,
  type Vector2,
  type Vector2Int,
  type WorldGenOptions,
  ZoneType,
  BuildingType,
  RoomType,
  WeatherType,
  HazardType,
  InteractableType,
  WrongnessState,
  type ZoneID,
  type BuildingID,
  type RoomID,
  type ItemID,
  type HazardID,
  type InteractableID,
} from './types.js';

import { SeededRandom, ID, valueNoise2D } from './utils.js';
import type { Interactable } from './types.js';

export class WorldGenerator {
  private seed: number;
  private rng: SeededRandom;
  private options: WorldGenOptions;

  // Caches (avoid regenerating)
  private zones: Map<ZoneID, Zone> = new Map();
  private buildings: Map<BuildingID, Building> = new Map();
  private rooms: Map<RoomID, Room> = new Map();

  constructor(options: WorldGenOptions) {
    this.options = options;
    this.seed = options.seed;
    this.rng = new SeededRandom(this.seed);
  }

  /**
   * Generate entire world
   */
  public generate(): {
    zones: Zone[];
    hqPosition: Vector2;
  } {
    const zones: Zone[] = [];
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
  private generateZoneGrid(count: number): Vector2[] {
    const gridSize = Math.ceil(Math.sqrt(count));
    const zoneSize = 2048; // World units per zone
    const positions: Vector2[] = [];

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        if (positions.length >= count) break;
        positions.push({
          x: i * zoneSize,
          y: j * zoneSize,
        });
      }
      if (positions.length >= count) break;
    }

    return positions;
  }

  /**
   * Generate single zone
   */
  private generateZone(position: Vector2): Zone {
    const zoneSeed = this.rng.nextInt(0, 1000000);
    const zoneRng = new SeededRandom(zoneSeed);
    const zoneID = ID.create<ZoneID>(`zone-${position.x}-${position.y}`);

    const zoneType = this.selectZoneType(zoneRng);
    const weatherState = zoneRng.pick(Object.values(WeatherType));

    // Generate buildings for this zone
    const buildingCount = zoneRng.nextInt(8, 12);
    const buildings: Building[] = [];
    const hazards: Hazard[] = [];
    const items: Item[] = [];
    const storyHooks: StoryHook[] = [];

    for (let i = 0; i < buildingCount; i++) {
      const buildingPos: Vector2 = {
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

    const zone: Zone = {
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

      // TEMP: placeholder assignment until the curated region/wrongness
      // ordering (the Finland -> Nepal-style progression discussed for
      // SkySystem's WrongnessState) gets designed. For now this just
      // satisfies the Zone interface so WorldGenerator compiles and runs —
      // every zone gets a random WrongnessState and a generic region label.
      // Replace this block once the real curated assignment logic exists.
      wrongnessState: zoneRng.pick(Object.values(WrongnessState)),
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
  private generateBuilding(position: Vector2, rng: SeededRandom): Building {
    const buildingID = ID.create<BuildingID>('building');
    const buildingSeed = rng.nextInt(0, 1_000_000); // deterministic — drawn
      // from this zone's RNG stream, unlike buildingID (which uses
      // Date.now()+Math.random() for uniqueness and is NOT reproducible
      // across runs). SVGBuildingFactory must seed its facade RNG from
      // this field, not from hashing buildingID.
    const buildingType = this.selectBuildingType(rng);

    const roomCount = rng.nextInt(4, 8);
    const rooms: Room[] = [];
    const items: Item[] = [];
    const hazards: Hazard[] = [];
    const storyHooks: StoryHook[] = [];
    const interactables: Interactable[] = [];

    // Generate rooms for building
    for (let i = 0; i < roomCount; i++) {
      const roomPos: Vector2Int = {
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

    const building: Building = {
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
  private generateRoom(
    buildingID: BuildingID,
    position: Vector2Int,
    rng: SeededRandom
  ): Room {
    const roomID = ID.create<RoomID>('room');
    const roomType = rng.pick(Object.values(RoomType));

    const items: Item[] = [];
    const hazards: Hazard[] = [];
    const interactables: Interactable[] = [];

    // Random items in room
    const itemCount = rng.nextInt(1, 5);
    for (let i = 0; i < itemCount; i++) {
      const item = this.generateItem(buildingID, roomID, rng);
      if (item) items.push(item);
    }

    // Random hazards in room
    if (rng.next() > 0.7) {
      const hazard = this.generateRoomHazard(roomID, rng);
      hazards.push(hazard);
    }

    // Interactables
    interactables.push(
      ...this.generateInteractables(roomID, roomType, rng)
    );

    const room: Room = {
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
  private generateItem(
    buildingID: BuildingID,
    roomID: RoomID,
    rng: SeededRandom
  ): Item | null {
    const isWeapon = rng.next() > 0.8;
    const iconIndex = rng.nextInt(1, isWeapon ? 20 : 100);

    const item: Item = {
      id: ID.create<ItemID>('item'),
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
  private generateRoomHazard(_roomID: RoomID, rng: SeededRandom): Hazard {
    const hazardType = rng.pick([
      HazardType.HUSK_NEST,
      HazardType.FOG_POCKET,
      HazardType.STRUCTURAL_DECAY,
    ]);

    const hazard: Hazard = {
      id: ID.create<HazardID>('hazard'),
      type: hazardType,
      position: { x: rng.nextFloat(50, 200), y: rng.nextFloat(50, 200) },
      radius: rng.nextFloat(30, 100),
      intensity: rng.nextFloat(0.3, 1),

      spawnTime: rng.nextFloat(0, 24),
      maxIntensity: rng.nextFloat(0.5, 1),
      rampSpeed: rng.nextFloat(0.1, 0.5),

      zoneID: 'zone-0-0' as ZoneID, // Updated during zone generation
      buildingID: null,
    };

    return hazard;
  }

  /**
   * Generate building-level hazards
   */
  private generateBuildingHazards(
    buildingID: BuildingID,
    rng: SeededRandom
  ): Hazard[] {
    const hazards: Hazard[] = [];
    const hazardCount = rng.nextInt(0, 2);

    for (let i = 0; i < hazardCount; i++) {
      const hazard: Hazard = {
        id: ID.create<HazardID>('hazard'),
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

        zoneID: 'zone-0-0' as ZoneID,
        buildingID,
      };
      hazards.push(hazard);
    }

    return hazards;
  }

  /**
   * Generate environmental hazards (zone-wide anomalies)
   */
  private generateEnvironmentalHazards(
    zoneID: ZoneID,
    zonePos: Vector2,
    rng: SeededRandom
  ): Hazard[] {
    const hazards: Hazard[] = [];

    // Fog pockets
    if (rng.next() > 0.5) {
      const fogCount = rng.nextInt(1, 3);
      for (let i = 0; i < fogCount; i++) {
        hazards.push({
          id: ID.create<HazardID>('hazard'),
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
        id: ID.create<HazardID>('hazard'),
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
  private generateInteractables(
    _roomID: RoomID,
    roomType: RoomType,
    rng: SeededRandom
  ): Interactable[] {
    const interactables: Interactable[] = [];

    // Always a door
    interactables.push({
      id: ID.create<InteractableID>('interactable'),
      type: InteractableType.DOOR,
      position: { x: rng.nextFloat(0, 256), y: rng.nextFloat(0, 256) },

      investigated: false,
    });

    // Investigation points in certain rooms
    if ([RoomType.ARCHIVE, RoomType.OFFICE, RoomType.SERVER_ROOM].includes(roomType)) {
      if (rng.next() > 0.5) {
        interactables.push({
          id: ID.create<InteractableID>('interactable'),
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
  private generateCollisionGrid(_roomCount: number, rng: SeededRandom): boolean[][] {
    const size = 8; // 8×8 grid
    const grid: boolean[][] = Array(size)
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
  private selectZoneType(rng: SeededRandom): ZoneType {
    const types = Object.values(ZoneType);
    return rng.pick(types);
  }

  /**
   * Select building type
   */
  private selectBuildingType(rng: SeededRandom): BuildingType {
    const types = Object.values(BuildingType);
    return rng.pick(types);
  }

  /**
   * Generate zone name
   */
  private generateZoneName(type: ZoneType, rng: SeededRandom): string {
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
  private generateBuildingName(type: BuildingType, rng: SeededRandom): string {
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
  private calculateDecayLevel(zoneType: ZoneType, difficulty: number): number {
    const base = difficulty / 10;
    const typeModifier = zoneType === ZoneType.RUINS ? 1.0 : 0.7;
    return Math.min(base * typeModifier, 1);
  }

  /**
   * Get zone by ID
   */
  public getZone(id: ZoneID): Zone | undefined {
    return this.zones.get(id);
  }

  /**
   * Get building by ID
   */
  public getBuilding(id: BuildingID): Building | undefined {
    return this.buildings.get(id);
  }

  /**
   * Get room by ID
   */
  public getRoom(id: RoomID): Room | undefined {
    return this.rooms.get(id);
  }

  /**
   * Get all zones
   */
  public getAllZones(): Zone[] {
    return Array.from(this.zones.values());
  }
}
