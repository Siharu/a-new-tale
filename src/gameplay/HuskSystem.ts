import {
  DetectionMethod,
  Drifter,
  HuskType,
  Zone,
  Vector2,
  WeatherType,
} from '../types.js';
import { ID, SeededRandom, Vec2 } from '../utils.js';
import { ThreatModel, type ThreatDetectionContext, type ThreatDetectionResult } from './ThreatModel.js';

export enum HuskState {
  PATROL = 'PATROL',
  ALERTED = 'ALERTED',
  INVESTIGATING = 'INVESTIGATING',
  SPOTTED = 'SPOTTED',
  PURSUING = 'PURSUING',
  ATTACKING = 'ATTACKING',
  LOST = 'LOST',
}

export interface HuskEntity {
  id: string;
  type: HuskType;
  position: Vector2;
  homePosition: Vector2;
  patrolRadius: number;
  state: HuskState;
  alertLevel: number; // 0–1
  lastKnownDrifterPosition: Vector2 | null;
  speed: number;
  noiseLevel: number;
  detectionBias: number;
  pursuitRange: number;
  isNocturnal: boolean;
  isStealthy: boolean;
  isGroupLeader: boolean;
  groupMembers: string[];
  timeSinceLastSight: number;
  timeSinceStateChange: number;
}

export interface HuskSystemCallbacks {
  onStateChange?: (husk: HuskEntity, previous: HuskState) => void;
  onAttack?: (husk: HuskEntity) => void;
  onLost?: (husk: HuskEntity) => void;
  onInvestigate?: (husk: HuskEntity, position: Vector2) => void;
}

export interface HuskSystemOptions {
  seed: number;
  zone: Zone;
  huskCount?: number;
  interactionRadius?: number;
  groupChance?: number;
  weather?: WeatherType;
}

export interface HuskUpdateResult {
  husk: HuskEntity;
  detection: ThreatDetectionResult;
}

const baseProfiles: Record<HuskType, Partial<HuskEntity>> = {
  [HuskType.SKOTH]: {
    speed: 60,
    noiseLevel: 0.45,
    detectionBias: 0.9,
    pursuitRange: 250,
    isNocturnal: false,
    isStealthy: false,
  },
  [HuskType.GLOWBUBS]: {
    speed: 55,
    noiseLevel: 0.55,
    detectionBias: 1.0,
    pursuitRange: 220,
    isNocturnal: false,
    isStealthy: false,
  },
  [HuskType.JAWIES]: {
    speed: 75,
    noiseLevel: 0.65,
    detectionBias: 0.95,
    pursuitRange: 240,
    isNocturnal: false,
    isStealthy: false,
  },
  [HuskType.WHITES]: {
    speed: 50,
    noiseLevel: 0.3,
    detectionBias: 1.25,
    pursuitRange: 280,
    isNocturnal: false,
    isStealthy: true,
  },
  [HuskType.OLDBONES]: {
    speed: 45,
    noiseLevel: 0.4,
    detectionBias: 1.1,
    pursuitRange: 240,
    isNocturnal: false,
    isStealthy: false,
  },
  [HuskType.DISABLED]: {
    speed: 50,
    noiseLevel: 0.25,
    detectionBias: 1.05,
    pursuitRange: 210,
    isNocturnal: false,
    isStealthy: true,
  },
  [HuskType.NOIRE]: {
    speed: 65,
    noiseLevel: 0.35,
    detectionBias: 1.15,
    pursuitRange: 300,
    isNocturnal: true,
    isStealthy: true,
  },
  [HuskType.BLOATERS]: {
    speed: 35,
    noiseLevel: 0.95,
    detectionBias: 0.85,
    pursuitRange: 200,
    isNocturnal: false,
    isStealthy: false,
  },
  [HuskType.AQUATIC]: {
    speed: 40,
    noiseLevel: 0.4,
    detectionBias: 0.9,
    pursuitRange: 220,
    isNocturnal: false,
    isStealthy: false,
  },
};

const typeWeights: Array<{ type: HuskType; weight: number }> = [
  { type: HuskType.SKOTH, weight: 1 },
  { type: HuskType.GLOWBUBS, weight: 1 },
  { type: HuskType.JAWIES, weight: 1 },
  { type: HuskType.WHITES, weight: 1 },
  { type: HuskType.OLDBONES, weight: 0.7 },
  { type: HuskType.DISABLED, weight: 0.8 },
  { type: HuskType.NOIRE, weight: 0.6 },
  { type: HuskType.BLOATERS, weight: 0.4 },
  { type: HuskType.AQUATIC, weight: 0.5 },
];

export class HuskSystem {
  private husks: HuskEntity[] = [];
  private rng: SeededRandom;
  private callbacks: HuskSystemCallbacks;
  private weather: WeatherType;
  private zone: Zone;

  constructor(options: HuskSystemOptions, callbacks: HuskSystemCallbacks = {}) {
    this.rng = new SeededRandom(options.seed);
    this.callbacks = callbacks;
    this.zone = options.zone;
    this.weather = options.weather ?? options.zone.weatherState;

    const count = options.huskCount ?? Math.max(4, Math.floor(options.zone.size.width / 512));
    this.husks = this.generateHusks(count, options.zone, options.groupChance ?? 0.2);
  }

  public getAllHusks(): HuskEntity[] {
    return this.husks.map((husk) => ({ ...husk }));
  }

  public getHusk(id: string): HuskEntity | undefined {
    return this.husks.find((husk) => husk.id === id);
  }

  public update(
    deltaSeconds: number,
    drifter: Drifter,
    context: ThreatDetectionContext
  ): HuskUpdateResult[] {
    const results: HuskUpdateResult[] = [];

    for (const husk of this.husks) {
      const previousState = husk.state;
      husk.timeSinceStateChange += deltaSeconds;
      husk.timeSinceLastSight += deltaSeconds;

      const threat = this.huskToThreatEntity(husk);
      const model = new ThreatModel(threat);
      const detection = model.detect(drifter, context);

      if (detection.detected) {
        this.applyDetectionToHusk(husk, detection, drifter);
      } else {
        this.deescalateHusk(husk, deltaSeconds, drifter);
      }

      this.advanceHuskMovement(husk, deltaSeconds, drifter);
      this.maybeTriggerEvents(husk, previousState);
      results.push({ husk, detection });
    }

    return results;
  }

  public addHusk(husk: HuskEntity): void {
    this.husks.push(husk);
  }

  public setWeather(weather: WeatherType): void {
    this.weather = weather;
  }

  public reset(callbacks?: HuskSystemCallbacks): void {
    if (callbacks) {
      this.callbacks = callbacks;
    }
    this.husks = this.generateHusks(this.husks.length, this.zone, 0.2);
  }

  private generateHusks(count: number, zone: Zone, groupChance: number): HuskEntity[] {
    const husks: HuskEntity[] = [];
    for (let index = 0; index < count; index++) {
      const type = this.pickHuskType();
      const homePosition: Vector2 = {
        x: zone.position.x + this.rng.nextFloat(100, zone.size.width - 100),
        y: zone.position.y + this.rng.nextFloat(100, zone.size.height - 100),
      };
      const profile = baseProfiles[type];
      const husk: HuskEntity = {
        id: ID.create<string>('husk'),
        type,
        position: { x: homePosition.x, y: homePosition.y },
        homePosition,
        patrolRadius: 180 + this.rng.nextFloat(0, 120),
        state: HuskState.PATROL,
        alertLevel: 0,
        lastKnownDrifterPosition: null,
        speed: profile.speed ?? 50,
        noiseLevel: profile.noiseLevel ?? 0.5,
        detectionBias: profile.detectionBias ?? 1,
        pursuitRange: profile.pursuitRange ?? 220,
        isNocturnal: profile.isNocturnal ?? false,
        isStealthy: profile.isStealthy ?? false,
        isGroupLeader: this.rng.next() < groupChance,
        groupMembers: [],
        timeSinceLastSight: 999,
        timeSinceStateChange: 0,
      };
      husks.push(husk);
    }
    return husks;
  }

  private pickHuskType(): HuskType {
    const total = typeWeights.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = this.rng.nextFloat(0, total);
    for (const entry of typeWeights) {
      if (roll <= entry.weight) {
        return entry.type;
      }
      roll -= entry.weight;
    }
    return HuskType.SKOTH;
  }

  private huskToThreatEntity(husk: HuskEntity) {
    return {
      id: husk.id,
      position: husk.position,
      category: 'HUSK' as const,
      subtype: husk.type,
      noiseLevel: husk.noiseLevel,
      isNocturnal: husk.isNocturnal,
      isStealthy: husk.isStealthy,
    };
  }

  private determineNoiseModifier(): number {
    switch (this.weather) {
      case WeatherType.STATIC_STORM:
      case WeatherType.DUST_EVENT:
        return 0.65;
      case WeatherType.OVERCAST:
      case WeatherType.FOG_HEAVY:
        return 0.85;
      default:
        return 1;
    }
  }

  private applyDetectionToHusk(husk: HuskEntity, detection: ThreatDetectionResult, drifter: Drifter): void {
    if (detection.methods.includes(DetectionMethod.SIGHT)) {
      husk.lastKnownDrifterPosition = { ...drifter.position };
      husk.timeSinceLastSight = 0;
      husk.alertLevel = Math.min(1, husk.alertLevel + 0.35);
      husk.state = HuskState.SPOTTED;
    } else if (detection.methods.includes(DetectionMethod.SOUND)) {
      husk.alertLevel = Math.min(1, husk.alertLevel + 0.25);
      husk.state = HuskState.ALERTED;
      husk.lastKnownDrifterPosition = { ...drifter.position };
    } else if (detection.methods.includes(DetectionMethod.VIBRATION)) {
      husk.alertLevel = Math.min(1, husk.alertLevel + 0.2);
      if (husk.state !== HuskState.SPOTTED && husk.state !== HuskState.PURSUING) {
        husk.state = HuskState.INVESTIGATING;
      }
      husk.lastKnownDrifterPosition = { ...drifter.position };
    }

    if (husk.alertLevel >= 0.9 && husk.state !== HuskState.ATTACKING) {
      husk.state = HuskState.PURSUING;
    }

    const closeEnough = detection.distance <= 50;
    if (closeEnough) {
      husk.state = HuskState.ATTACKING;
    }
  }

  private deescalateHusk(husk: HuskEntity, deltaSeconds: number, _drifter: Drifter): void {
    if (husk.state === HuskState.PATROL) {
      this.patrolMovement(husk, deltaSeconds);
      return;
    }

    if (husk.timeSinceLastSight > 6) {
      if (husk.state === HuskState.SPOTTED || husk.state === HuskState.PURSUING || husk.state === HuskState.ATTACKING) {
        husk.state = HuskState.LOST;
        husk.alertLevel = Math.max(0, husk.alertLevel - 0.35);
      } else if (husk.state === HuskState.ALERTED || husk.state === HuskState.INVESTIGATING) {
        husk.alertLevel = Math.max(0, husk.alertLevel - 0.2);
      }
    }

    if (husk.state === HuskState.LOST && husk.timeSinceStateChange > 5) {
      husk.state = HuskState.PATROL;
      husk.alertLevel = 0;
      husk.lastKnownDrifterPosition = null;
    }
  }

  private advanceHuskMovement(husk: HuskEntity, deltaSeconds: number, drifter: Drifter): void {
    const speed = husk.speed * (1 + husk.alertLevel * 0.35) * this.determineNoiseModifier();
    let destination: Vector2 | null = null;

    switch (husk.state) {
      case HuskState.PATROL:
        destination = this.patrolPoint(husk);
        break;
      case HuskState.ALERTED:
      case HuskState.INVESTIGATING:
        destination = husk.lastKnownDrifterPosition ?? husk.homePosition;
        break;
      case HuskState.SPOTTED:
      case HuskState.PURSUING:
      case HuskState.ATTACKING:
        destination = drifter.position;
        break;
      case HuskState.LOST:
        destination = husk.homePosition;
        break;
    }

    if (!destination) {
      return;
    }

    const delta = Vec2.subtract(destination, husk.position);
    const distance = Vec2.magnitude(delta);
    if (distance === 0) {
      return;
    }

    const travel = Math.min(distance, speed * deltaSeconds);
    husk.position = Vec2.add(husk.position, Vec2.multiply(Vec2.normalize(delta), travel));
  }

  private patrolMovement(husk: HuskEntity, deltaSeconds: number): void {
    const circle = HuskSystem.makeCircleDestination(husk.homePosition, husk.patrolRadius, this.rng);
    const delta = Vec2.subtract(circle, husk.position);
    const distance = Vec2.magnitude(delta);
    if (distance === 0) {
      return;
    }
    const travel = Math.min(husk.speed * deltaSeconds * 0.75, distance);
    husk.position = Vec2.add(husk.position, Vec2.multiply(Vec2.normalize(delta), travel));
  }

  private static makeCircleDestination(center: Vector2, radius: number, rng: SeededRandom): Vector2 {
    const angle = rng.nextFloat(0, Math.PI * 2);
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
  }

  private patrolPoint(husk: HuskEntity): Vector2 {
    if (!husk.lastKnownDrifterPosition) {
      return HuskSystem.makeCircleDestination(husk.homePosition, husk.patrolRadius, this.rng);
    }
    return husk.lastKnownDrifterPosition;
  }

  private maybeTriggerEvents(husk: HuskEntity, previousState: HuskState): void {
    if (husk.state !== previousState && this.callbacks.onStateChange) {
      this.callbacks.onStateChange(husk, previousState);
      husk.timeSinceStateChange = 0;
    }

    if (husk.state === HuskState.ATTACKING && previousState !== HuskState.ATTACKING && this.callbacks.onAttack) {
      this.callbacks.onAttack(husk);
    }

    if (husk.state === HuskState.LOST && previousState !== HuskState.LOST && this.callbacks.onLost) {
      this.callbacks.onLost(husk);
    }

    if (husk.state === HuskState.INVESTIGATING && this.callbacks.onInvestigate && husk.lastKnownDrifterPosition) {
      this.callbacks.onInvestigate(husk, husk.lastKnownDrifterPosition);
    }
  }
}
