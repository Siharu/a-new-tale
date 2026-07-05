/**
 * DRIFTER ENGINE TYPE DEFINITIONS
 * No implementation — pure schema/contracts
 */
export type ZoneID = string & {
    readonly __brand: 'ZoneID';
};
export type BuildingID = string & {
    readonly __brand: 'BuildingID';
};
export type RoomID = string & {
    readonly __brand: 'RoomID';
};
export type ItemID = string & {
    readonly __brand: 'ItemID';
};
export type WeaponID = string & {
    readonly __brand: 'WeaponID';
};
export type HazardID = string & {
    readonly __brand: 'HazardID';
};
export type InteractableID = string & {
    readonly __brand: 'InteractableID';
};
export type DrifterID = string & {
    readonly __brand: 'DrifterID';
};
export type RunID = string & {
    readonly __brand: 'RunID';
};
export type EntryID = string & {
    readonly __brand: 'EntryID';
};
export type EvidenceChainID = string & {
    readonly __brand: 'EvidenceChainID';
};
export type StoryHookID = string & {
    readonly __brand: 'StoryHookID';
};
export declare enum ZoneType {
    RESIDENTIAL_DISTRICT = "RESIDENTIAL_DISTRICT",
    INDUSTRIAL_COMPLEX = "INDUSTRIAL_COMPLEX",
    RURAL_RELAY = "RURAL_RELAY",
    SIGNAL_HUB = "SIGNAL_HUB",
    ARCHIVE = "ARCHIVE",
    RUINS = "RUINS"
}
export declare enum BuildingType {
    RESIDENTIAL = "RESIDENTIAL",
    INDUSTRIAL = "INDUSTRIAL",
    SIGNAL_TOWER = "SIGNAL_TOWER",
    ARCHIVE = "ARCHIVE",
    MAINTENANCE = "MAINTENANCE",
    RADIO_STATION = "RADIO_STATION",
    POWER_PLANT = "POWER_PLANT",
    WAREHOUSE = "WAREHOUSE"
}
export declare enum RoomType {
    OFFICE = "OFFICE",
    STORAGE = "STORAGE",
    RADIO_STATION = "RADIO_STATION",
    SERVER_ROOM = "SERVER_ROOM",
    ARCHIVE = "ARCHIVE",
    HALLWAY = "HALLWAY",
    BASEMENT = "BASEMENT",
    ROOFTOP = "ROOFTOP",
    LIVING_QUARTERS = "LIVING_QUARTERS",
    LABORATORY = "LABORATORY"
}
export declare enum WeatherType {
    CLEAR = "CLEAR",
    OVERCAST = "OVERCAST",
    FOG_HEAVY = "FOG_HEAVY",
    ACID_RAIN = "ACID_RAIN",
    DEAD_CALM = "DEAD_CALM",
    STATIC_STORM = "STATIC_STORM",
    DUST_EVENT = "DUST_EVENT"
}
export declare enum WrongnessState {
    SUNNY = "SUNNY",
    BLUE = "BLUE",
    GREY = "GREY",
    RAINY = "RAINY",
    STATIC = "STATIC",
    UNKNOWN = "UNKNOWN",
    STORMY = "STORMY",
    DIFFERENT = "DIFFERENT",
    ANOTHER_SKY = "ANOTHER_SKY"
}
export declare enum HazardType {
    HUSK_NEST = "HUSK_NEST",
    FOG_POCKET = "FOG_POCKET",
    SIGNAL_DEAD_ZONE = "SIGNAL_DEAD_ZONE",
    STRUCTURAL_DECAY = "STRUCTURAL_DECAY",
    ACID_RAIN_ZONE = "ACID_RAIN_ZONE",
    ANOMALY = "ANOMALY"
}
export declare enum InteractableType {
    ITEM = "ITEM",
    DOOR = "DOOR",
    ANOMALY = "ANOMALY",
    HQ_ENTRANCE = "HQ_ENTRANCE",
    INVESTIGATION_POINT = "INVESTIGATION_POINT"
}
export declare enum LogbookEntryType {
    ITEM = "ITEM",
    DOCUMENT = "DOCUMENT",
    PHOTO = "PHOTO",
    BROADCAST = "BROADCAST",
    DEDUCTION = "DEDUCTION",
    NOTE = "NOTE"
}
export declare enum Direction {
    N = "N",
    NE = "NE",
    E = "E",
    SE = "SE",
    S = "S",
    SW = "SW",
    W = "W",
    NW = "NW"
}
export declare enum RunStatus {
    ACTIVE = "ACTIVE",
    SUCCESS = "SUCCESS",
    DEATH = "DEATH"
}
export declare enum HuskType {
    SKOTH = "SKOTH",
    GLOWBUBS = "GLOWBUBS",
    JAWIES = "JAWIES",
    WHITES = "WHITES",
    OLDBONES = "OLDBONES",
    DISABLED = "DISABLED",
    NOIRE = "NOIRE",
    BLOATERS = "BLOATERS",
    AQUATIC = "AQUATIC"
}
export declare enum InfectedType {
    THEY_THINK = "THEY_THINK",
    THEY_TALK = "THEY_TALK",
    THEY_TRICK = "THEY_TRICK",
    THEY_TAKE = "THEY_TAKE",
    GLITCH = "GLITCH"
}
export declare enum GhuulType {
    APEX = "APEX"
}
export declare enum DetectionMethod {
    SIGHT = "SIGHT",
    SOUND = "SOUND",
    VIBRATION = "VIBRATION",
    SMELL = "SMELL",
    BEHAVIOR = "BEHAVIOR",
    UNKNOWN = "UNKNOWN"
}
export interface Vector2 {
    x: number;
    y: number;
}
export interface Vector2Int {
    x: number;
    y: number;
}
export interface Size2 {
    width: number;
    height: number;
}
export interface Zone {
    id: ZoneID;
    name: string;
    type: ZoneType;
    position: Vector2;
    size: Size2;
    seed: number;
    timeOfDay: number;
    weatherState: WeatherType;
    fogIntensity: number;
    decayLevel: number;
    wrongnessState: WrongnessState;
    region: string;
    buildings: Building[];
    hazards: Hazard[];
    storyHooks: StoryHook[];
    items: Item[];
    hqEntrance: {
        position: Vector2;
        interactable: boolean;
    } | null;
}
export interface Building {
    id: BuildingID;
    name: string;
    type: BuildingType;
    position: Vector2;
    size: Size2;
    rooms: Room[];
    collisionGrid: boolean[][];
    items: Item[];
    hazards: Hazard[];
    storyHooks: StoryHook[];
    interactables: Interactable[];
    svgMesh: unknown;
    decayState: number;
    exploredState: number;
    seed: number;
}
export interface Room {
    id: RoomID;
    name: string;
    position: Vector2Int;
    size: Size2;
    type: RoomType;
    items: Item[];
    hazards: Hazard[];
    interactables: Interactable[];
    exploredState: number;
    decayState: number;
}
export interface Item {
    id: ItemID;
    name: string;
    description: string;
    iconIndex: number;
    isWeapon: false;
    value: number;
    weight: number;
    position: Vector2;
    buildingID: BuildingID;
    roomID: RoomID | null;
}
export interface Weapon {
    id: WeaponID;
    name: string;
    description: string;
    iconIndex: number;
    isWeapon: true;
    damage: number;
    weight: number;
    position: Vector2;
    buildingID: BuildingID;
    roomID: RoomID | null;
}
export interface Hazard {
    id: HazardID;
    type: HazardType;
    position: Vector2;
    radius: number;
    intensity: number;
    spawnTime: number;
    maxIntensity: number;
    rampSpeed: number;
    zoneID: ZoneID;
    buildingID: BuildingID | null;
}
export interface Interactable {
    id: InteractableID;
    type: InteractableType;
    position: Vector2;
    linkedItem?: Item;
    linkedRoom?: RoomID;
    linkedStoryHook?: StoryHook;
    investigated: boolean;
}
export interface StoryHook {
    id: StoryHookID;
    name: string;
    description: string;
    linkedEntry: EntryID;
    linkedChain?: EvidenceChainID;
    position: Vector2;
    buildingID: BuildingID;
    roomID?: RoomID;
    discoveryCondition: 'PROXIMITY' | 'INVESTIGATION' | 'PICKUP';
}
export interface LogbookEntry {
    id: EntryID;
    type: LogbookEntryType;
    title: string;
    text: string;
    timestamp: number;
    tags: string[];
    relatedEntries: EntryID[];
    chainID?: EvidenceChainID;
    image?: string;
    portraitEmotion?: string;
}
export interface EvidenceChain {
    id: EvidenceChainID;
    name: string;
    requiredEntries: EntryID[];
    deduction: LogbookEntry;
    progress: number;
}
export interface DrifterAppearance {
    variant: number;
    emotion: string;
}
export interface Drifter {
    id: DrifterID;
    name: string;
    origin: string;
    appearance: DrifterAppearance;
    position: Vector2;
    facing: Direction;
    currentZone: ZoneID;
    currentBuilding: BuildingID | null;
    currentRoom: RoomID | null;
    health: number;
    signalStrength: number;
    airQuality: number;
    inventory: (Item | Weapon)[];
    maxInventory: number;
    logbook: LogbookEntry[];
    evidenceChains: EvidenceChain[];
    drifterSeed: number;
    runID: RunID;
    timeAlive: number;
}
export interface Run {
    id: RunID;
    drifter: Drifter;
    startTime: number;
    endTime: number | null;
    worldSeed: number;
    worldTimeOfDay: number;
    resourcesCollected: Item[];
    logbookFinal: LogbookEntry[];
    deductionsMade: LogbookEntry[];
    status: RunStatus;
    causeOfDeath?: string;
}
export interface RunSummary {
    runID: RunID;
    drifterName: string;
    duration: number;
    resourcesExtracted: number;
    deductionsMade: number;
    status: RunStatus;
    causeOfDeath?: string;
    timestamp: number;
}
export interface World {
    seed: number;
    zones: Zone[];
    hqPosition: Vector2;
    timeOfDay: number;
    era: string;
    difficulty: number;
}
export interface WorldGenOptions {
    seed: number;
    zoneCount: number;
    difficulty: number;
    era: string;
    hqPosition?: Vector2;
}
export interface BuildingGenOptions {
    seed: number;
    type: BuildingType;
    maxRooms: number;
    decayState: number;
}
//# sourceMappingURL=types.d.ts.map