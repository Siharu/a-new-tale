import { Drifter, HuskType, Zone, Vector2, WeatherType } from '../types.js';
import { type ThreatDetectionContext, type ThreatDetectionResult } from './ThreatModel.js';
export declare enum HuskState {
    PATROL = "PATROL",
    ALERTED = "ALERTED",
    INVESTIGATING = "INVESTIGATING",
    SPOTTED = "SPOTTED",
    PURSUING = "PURSUING",
    ATTACKING = "ATTACKING",
    LOST = "LOST"
}
export interface HuskEntity {
    id: string;
    type: HuskType;
    position: Vector2;
    homePosition: Vector2;
    patrolRadius: number;
    state: HuskState;
    alertLevel: number;
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
export declare class HuskSystem {
    private husks;
    private rng;
    private callbacks;
    private weather;
    private zone;
    constructor(options: HuskSystemOptions, callbacks?: HuskSystemCallbacks);
    getAllHusks(): HuskEntity[];
    getHusk(id: string): HuskEntity | undefined;
    update(deltaSeconds: number, drifter: Drifter, context: ThreatDetectionContext): HuskUpdateResult[];
    addHusk(husk: HuskEntity): void;
    setWeather(weather: WeatherType): void;
    reset(callbacks?: HuskSystemCallbacks): void;
    private generateHusks;
    private pickHuskType;
    private huskToThreatEntity;
    private determineNoiseModifier;
    private applyDetectionToHusk;
    private deescalateHusk;
    private advanceHuskMovement;
    private patrolMovement;
    private static makeCircleDestination;
    private patrolPoint;
    private maybeTriggerEvents;
}
//# sourceMappingURL=HuskSystem.d.ts.map