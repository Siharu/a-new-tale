import { Building, Drifter, Vector2, Zone } from '../types.js';
export interface MovementControllerOptions {
    drifter: Drifter;
    zone: Zone;
    building: Building | null;
    movementSpeed?: number;
    bodySize?: number;
}
export declare class MovementController {
    private drifter;
    private zone;
    private building;
    private movementSpeed;
    private input;
    constructor(options: MovementControllerOptions);
    setBuilding(building: Building | null): void;
    setZone(zone: Zone): void;
    setInput(input: Vector2): void;
    update(deltaSeconds: number): void;
    private updateFacing;
    private resolveCollision;
    private clampToZone;
    private resolveBuildingCollision;
    private worldToGrid;
    private isBlocked;
}
//# sourceMappingURL=MovementController.d.ts.map