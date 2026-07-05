import { Drifter, HuskType, InfectedType, GhuulType, WeatherType, Vector2 } from '../types.js';
import { DetectionMethod } from '../types.js';
export interface ThreatEntity {
    id: string;
    position: Vector2;
    category: 'HUSK' | 'INFECTED' | 'GHUUL' | 'UNKNOWN';
    subtype: HuskType | InfectedType | GhuulType | string;
    noiseLevel: number;
    isNocturnal?: boolean;
    isStealthy?: boolean;
}
export interface ThreatDetectionContext {
    drifterNoise: number;
    ambientNoise: number;
    timeOfDay: number;
    weather: WeatherType;
    obstacles: Array<{
        position: Vector2;
        size: {
            width: number;
            height: number;
        };
    }>;
}
export interface ThreatDetectionResult {
    detected: boolean;
    methods: DetectionMethod[];
    distance: number;
    sightRange: number;
    hearingRange: number;
}
export declare class ThreatModel {
    private threat;
    constructor(threat: ThreatEntity);
    detect(drifter: Drifter, context: ThreatDetectionContext): ThreatDetectionResult;
    private calculateSightRange;
    private calculateHearingRange;
    private calculateVibrationRadius;
    private baseVisualRange;
    private hasLineOfSight;
    private intersectsLine;
}
//# sourceMappingURL=ThreatModel.d.ts.map