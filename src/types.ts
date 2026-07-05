/**
 * DRIFTER ENGINE TYPE DEFINITIONS
 * No implementation — pure schema/contracts
 */

// ─── IDENTIFIERS ───
export type ZoneID = string & { readonly __brand: 'ZoneID' };
export type BuildingID = string & { readonly __brand: 'BuildingID' };
export type RoomID = string & { readonly __brand: 'RoomID' };
export type ItemID = string & { readonly __brand: 'ItemID' };
export type WeaponID = string & { readonly __brand: 'WeaponID' };
export type HazardID = string & { readonly __brand: 'HazardID' };
export type InteractableID = string & { readonly __brand: 'InteractableID' };
export type DrifterID = string & { readonly __brand: 'DrifterID' };
export type RunID = string & { readonly __brand: 'RunID' };
export type EntryID = string & { readonly __brand: 'EntryID' };
export type EvidenceChainID = string & { readonly __brand: 'EvidenceChainID' };
export type StoryHookID = string & { readonly __brand: 'StoryHookID' };

// ─── ENUMS ───
export enum ZoneType {
  RESIDENTIAL_DISTRICT = 'RESIDENTIAL_DISTRICT',
  INDUSTRIAL_COMPLEX = 'INDUSTRIAL_COMPLEX',
  RURAL_RELAY = 'RURAL_RELAY',
  SIGNAL_HUB = 'SIGNAL_HUB',
  ARCHIVE = 'ARCHIVE',
  RUINS = 'RUINS',
}

export enum BuildingType {
  RESIDENTIAL = 'RESIDENTIAL',
  INDUSTRIAL = 'INDUSTRIAL',
  SIGNAL_TOWER = 'SIGNAL_TOWER',
  ARCHIVE = 'ARCHIVE',
  MAINTENANCE = 'MAINTENANCE',
  RADIO_STATION = 'RADIO_STATION',
  POWER_PLANT = 'POWER_PLANT',
  WAREHOUSE = 'WAREHOUSE',
}

export enum RoomType {
  OFFICE = 'OFFICE',
  STORAGE = 'STORAGE',
  RADIO_STATION = 'RADIO_STATION',
  SERVER_ROOM = 'SERVER_ROOM',
  ARCHIVE = 'ARCHIVE',
  HALLWAY = 'HALLWAY',
  BASEMENT = 'BASEMENT',
  ROOFTOP = 'ROOFTOP',
  LIVING_QUARTERS = 'LIVING_QUARTERS',
  LABORATORY = 'LABORATORY',
}

export enum WeatherType {
  CLEAR = 'CLEAR',
  OVERCAST = 'OVERCAST',
  FOG_HEAVY = 'FOG_HEAVY',
  ACID_RAIN = 'ACID_RAIN',
  DEAD_CALM = 'DEAD_CALM',
  STATIC_STORM = 'STATIC_STORM',
  DUST_EVENT = 'DUST_EVENT',
}

export enum WrongnessState {
  SUNNY = 'SUNNY',
  BLUE = 'BLUE',
  GREY = 'GREY',
  RAINY = 'RAINY',
  STATIC = 'STATIC',
  UNKNOWN = 'UNKNOWN',
  STORMY = 'STORMY',
  DIFFERENT = 'DIFFERENT',
  ANOTHER_SKY = 'ANOTHER_SKY',
}

export enum HazardType {
  HUSK_NEST = 'HUSK_NEST',
  FOG_POCKET = 'FOG_POCKET',
  SIGNAL_DEAD_ZONE = 'SIGNAL_DEAD_ZONE',
  STRUCTURAL_DECAY = 'STRUCTURAL_DECAY',
  ACID_RAIN_ZONE = 'ACID_RAIN_ZONE',
  ANOMALY = 'ANOMALY',
}

export enum InteractableType {
  ITEM = 'ITEM',
  DOOR = 'DOOR',
  ANOMALY = 'ANOMALY',
  HQ_ENTRANCE = 'HQ_ENTRANCE',
  INVESTIGATION_POINT = 'INVESTIGATION_POINT',
}

export enum LogbookEntryType {
  ITEM = 'ITEM',
  DOCUMENT = 'DOCUMENT',
  PHOTO = 'PHOTO',
  BROADCAST = 'BROADCAST',
  DEDUCTION = 'DEDUCTION',
  NOTE = 'NOTE',
}

export enum Direction {
  N = 'N',
  NE = 'NE',
  E = 'E',
  SE = 'SE',
  S = 'S',
  SW = 'SW',
  W = 'W',
  NW = 'NW',
}

export enum RunStatus {
  ACTIVE = 'ACTIVE',
  SUCCESS = 'SUCCESS',
  DEATH = 'DEATH',
}
// ─── THREAT TYPES ───
export enum HuskType {
  SKOTH = 'SKOTH',
  GLOWBUBS = 'GLOWBUBS',
  JAWIES = 'JAWIES',
  WHITES = 'WHITES',
  OLDBONES = 'OLDBONES',
  DISABLED = 'DISABLED',
  NOIRE = 'NOIRE',
  BLOATERS = 'BLOATERS',
  AQUATIC = 'AQUATIC',
}

export enum InfectedType {
  THEY_THINK = 'THEY_THINK',
  THEY_TALK = 'THEY_TALK',
  THEY_TRICK = 'THEY_TRICK',
  THEY_TAKE = 'THEY_TAKE',
  GLITCH = 'GLITCH',
}

export enum GhuulType {
  APEX = 'APEX',
}

export enum DetectionMethod {
  SIGHT = 'SIGHT',
  SOUND = 'SOUND',
  VIBRATION = 'VIBRATION',
  SMELL = 'SMELL',
  BEHAVIOR = 'BEHAVIOR',
  UNKNOWN = 'UNKNOWN',
}
// ─── VECTORS ───
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

// ─── ZONE ───
export interface Zone {
  id: ZoneID;
  name: string;
  type: ZoneType;
  position: Vector2;
  size: Size2;
  
  seed: number;
  timeOfDay: number; // 0–24 (hours)
  weatherState: WeatherType;
  fogIntensity: number; // 0–1, Fog of Medusa
  decayLevel: number; // 0–1
  
  // ─── reality-stability axis, separate from WeatherType ───
  wrongnessState: WrongnessState;
  region: string; // e.g. "Finland", "Nepal" — narrative label, drives WorldGenerator's curated order
  
  buildings: Building[];
  hazards: Hazard[];
  storyHooks: StoryHook[];
  items: Item[];
  
  hqEntrance: {
    position: Vector2;
    interactable: boolean;
  } | null;
}

// ─── BUILDING ───
export interface Building {
  id: BuildingID;
  name: string;
  type: BuildingType;
  position: Vector2;
  size: Size2;
  
  rooms: Room[];
  collisionGrid: boolean[][]; // true = blocked
  
  items: Item[];
  hazards: Hazard[];
  storyHooks: StoryHook[];
  interactables: Interactable[];
  
  svgMesh: unknown; // THREE.Mesh, but avoid Three.js in types
  decayState: number; // 0–1
  exploredState: number; // 0–1
  seed: number; // deterministic per-building seed, derived from the zone's
                // RNG at generation time — NOT from `id` (id uses
                // Date.now()+Math.random() for uniqueness and is therefore
                // non-deterministic; visual generation must use this field
                // instead so the same WorldGenerator seed always produces
                // the same building facade)
}

// ─── ROOM ───
export interface Room {
  id: RoomID;
  name: string;
  position: Vector2Int; // Building-relative grid coords
  size: Size2;
  type: RoomType;
  
  items: Item[];
  hazards: Hazard[];
  interactables: Interactable[];
  
  exploredState: number; // 0–1
  decayState: number; // 0–1
}

// ─── ITEM ───
export interface Item {
  id: ItemID;
  name: string;
  description: string;
  iconIndex: number; // References navigator/items/{index}.png
  
  isWeapon: false;
  value: number; // Resource value if extracted
  weight: number; // For inventory slots
  
  position: Vector2;
  buildingID: BuildingID;
  roomID: RoomID | null;
}

// ─── WEAPON ───
export interface Weapon {
  id: WeaponID;
  name: string;
  description: string;
  iconIndex: number; // References navigator/weps/{index}.png
  
  isWeapon: true;
  damage: number;
  weight: number; // For inventory slots
  
  position: Vector2;
  buildingID: BuildingID;
  roomID: RoomID | null;
}

// ─── HAZARD ───
export interface Hazard {
  id: HazardID;
  type: HazardType;
  position: Vector2;
  radius: number;
  intensity: number; // 0–1
  
  spawnTime: number; // World time when spawned
  maxIntensity: number;
  rampSpeed: number; // Intensity increase per second
  
  zoneID: ZoneID;
  buildingID: BuildingID | null;
}

// ─── INTERACTABLE ───
export interface Interactable {
  id: InteractableID;
  type: InteractableType;
  position: Vector2;
  
  linkedItem?: Item;
  linkedRoom?: RoomID;
  linkedStoryHook?: StoryHook;
  
  investigated: boolean;
}

// ─── STORY HOOK ───
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

// ─── DISCOVERY / LOGBOOK ───
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
  
  progress: number; // 0–1
}

// ─── DRIFTER ───
export interface DrifterAppearance {
  variant: number; // 1–3 (from WNCORE portrait pack)
  emotion: string; // Handler portrait emotion
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
  
  health: number; // 0–100
  signalStrength: number; // 0–100
  airQuality: number; // 0–100
  
  inventory: (Item | Weapon)[];
  maxInventory: number;
  
  logbook: LogbookEntry[];
  evidenceChains: EvidenceChain[];
  
  drifterSeed: number;
  runID: RunID;
  timeAlive: number; // Seconds
}

// ─── RUN / PERMADEATH ───
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
  duration: number; // Seconds
  resourcesExtracted: number;
  deductionsMade: number;
  status: RunStatus;
  causeOfDeath?: string;
  timestamp: number;
}

// ─── WORLD ───
export interface World {
  seed: number;
  zones: Zone[];
  hqPosition: Vector2;
  
  timeOfDay: number; // 0–24
  era: string; // "Early Collapse" | "Peak Decay" | "Stabilization" etc.
  difficulty: number; // 1–10
}

// ─── GENERATION OPTIONS ───
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