import {
  Drifter,
  HuskType,
  InfectedType,
  GhuulType,
  WeatherType,
  Vector2,
} from '../types.js';
import { Vec2 } from '../utils.js';
import { DetectionMethod } from '../types.js';

export interface ThreatEntity {
  id: string;
  position: Vector2;
  category: 'HUSK' | 'INFECTED' | 'GHUUL' | 'UNKNOWN';
  subtype: HuskType | InfectedType | GhuulType | string;
  noiseLevel: number; // 0–1
  isNocturnal?: boolean;
  isStealthy?: boolean;
}

export interface ThreatDetectionContext {
  drifterNoise: number; // 0–1
  ambientNoise: number; // 0–1
  timeOfDay: number; // 0–24
  weather: WeatherType;
  obstacles: Array<{ position: Vector2; size: { width: number; height: number } }>;
}

export interface ThreatDetectionResult {
  detected: boolean;
  methods: DetectionMethod[];
  distance: number;
  sightRange: number;
  hearingRange: number;
}

export class ThreatModel {
  private threat: ThreatEntity;

  constructor(threat: ThreatEntity) {
    this.threat = threat;
  }

  public detect(
    drifter: Drifter,
    context: ThreatDetectionContext
  ): ThreatDetectionResult {
    const distance = Vec2.distance(drifter.position, this.threat.position);
    const sightRange = this.calculateSightRange(context);
    const hearingRange = this.calculateHearingRange(context);

    const methods: DetectionMethod[] = [];

    if (distance <= sightRange && this.hasLineOfSight(drifter.position, context.obstacles)) {
      methods.push(DetectionMethod.SIGHT);
    }

    if (distance <= hearingRange && context.drifterNoise > 0.1) {
      methods.push(DetectionMethod.SOUND);
    }

    if (distance <= this.calculateVibrationRadius(context)) {
      methods.push(DetectionMethod.VIBRATION);
    }

    return {
      detected: methods.length > 0,
      methods,
      distance,
      sightRange,
      hearingRange,
    };
  }

  private calculateSightRange(context: ThreatDetectionContext): number {
    const base = this.baseVisualRange();
    let modifier = 1;

    if (this.threat.isNocturnal && (context.timeOfDay >= 18 || context.timeOfDay <= 6)) {
      modifier += 0.25;
    }

    switch (context.weather) {
      case WeatherType.FOG_HEAVY:
      case WeatherType.DUST_EVENT:
      case WeatherType.STATIC_STORM:
        modifier -= 0.5;
        break;
      case WeatherType.OVERCAST:
      case WeatherType.DEAD_CALM:
        modifier -= 0.15;
        break;
      default:
        break;
    }

    return Math.max(50, base * Math.max(0.4, modifier));
  }

  private calculateHearingRange(context: ThreatDetectionContext): number {
    const base = 150 + this.threat.noiseLevel * 150;
    const ambientPenalty = 1 - context.ambientNoise * 0.5;
    const stealthPenalty = this.threat.isStealthy ? 0.75 : 1;

    return Math.max(30, base * ambientPenalty * stealthPenalty);
  }

  private calculateVibrationRadius(context: ThreatDetectionContext): number {
    return 100 + context.drifterNoise * 200;
  }

  private baseVisualRange(): number {
    switch (this.threat.category) {
      case 'GHUUL':
        return 450;
      case 'INFECTED':
        return 300;
      case 'HUSK':
        return 220;
      default:
        return 180;
    }
  }

  private hasLineOfSight(
    source: Vector2,
    obstacles: Array<{ position: Vector2; size: { width: number; height: number } }>
  ): boolean {
    for (const obstacle of obstacles) {
      if (this.intersectsLine(source, this.threat.position, obstacle)) {
        return false;
      }
    }
    return true;
  }

  private intersectsLine(
    from: Vector2,
    to: Vector2,
    obstacle: { position: Vector2; size: { width: number; height: number } }
  ): boolean {
    const x1 = from.x;
    const y1 = from.y;
    const x2 = to.x;
    const y2 = to.y;

    const rect = {
      left: obstacle.position.x,
      right: obstacle.position.x + obstacle.size.width,
      top: obstacle.position.y,
      bottom: obstacle.position.y + obstacle.size.height,
    };

    const stepCount = 32;
    for (let step = 0; step <= stepCount; step++) {
      const t = step / stepCount;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return true;
      }
    }

    return false;
  }
}
