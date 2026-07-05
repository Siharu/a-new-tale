import { Direction } from '../types.js';
import { Grid, Vec2 } from '../utils.js';
export class MovementController {
    constructor(options) {
        this.input = { x: 0, y: 0 };
        this.drifter = options.drifter;
        this.zone = options.zone;
        this.building = options.building;
        this.movementSpeed = options.movementSpeed ?? 120;
    }
    setBuilding(building) {
        this.building = building;
    }
    setZone(zone) {
        this.zone = zone;
    }
    setInput(input) {
        this.input = {
            x: Math.max(-1, Math.min(1, input.x)),
            y: Math.max(-1, Math.min(1, input.y)),
        };
        if (this.input.x !== 0 || this.input.y !== 0) {
            this.updateFacing();
        }
    }
    update(deltaSeconds) {
        if (deltaSeconds <= 0) {
            return;
        }
        const direction = Vec2.normalize(this.input);
        if (direction.x === 0 && direction.y === 0) {
            return;
        }
        const motion = Vec2.multiply(direction, this.movementSpeed * deltaSeconds);
        const proposed = Vec2.add(this.drifter.position, motion);
        const resolved = this.resolveCollision(proposed);
        this.drifter.position = resolved;
        this.drifter.timeAlive += deltaSeconds;
    }
    updateFacing() {
        const input = this.input;
        if (Math.abs(input.x) > Math.abs(input.y)) {
            this.drifter.facing = input.x > 0 ? Direction.E : Direction.W;
        }
        else if (input.y !== 0) {
            this.drifter.facing = input.y > 0 ? Direction.S : Direction.N;
        }
    }
    resolveCollision(proposed) {
        if (!this.building) {
            return this.clampToZone(proposed);
        }
        const candidate = this.resolveBuildingCollision(proposed);
        const clamped = this.clampToZone(candidate);
        return clamped;
    }
    clampToZone(position) {
        return {
            x: Math.max(0, Math.min(position.x, this.zone.size.width)),
            y: Math.max(0, Math.min(position.y, this.zone.size.height)),
        };
    }
    resolveBuildingCollision(proposed) {
        if (!this.building) {
            return proposed;
        }
        const local = {
            x: proposed.x - this.building.position.x,
            y: proposed.y - this.building.position.y,
        };
        const cellSize = this.building.size.width / this.building.collisionGrid.length;
        const gridPos = {
            x: Math.floor(local.x / cellSize),
            y: Math.floor(local.y / cellSize),
        };
        const gridBounds = {
            width: this.building.collisionGrid[0]?.length ?? 0,
            height: this.building.collisionGrid.length,
        };
        if (!Grid.inBounds(gridPos, gridBounds)) {
            return this.drifter.position;
        }
        if (this.isBlocked(gridPos)) {
            const xOnly = { x: proposed.x, y: this.drifter.position.y };
            const yOnly = { x: this.drifter.position.x, y: proposed.y };
            if (!this.isBlocked(this.worldToGrid(xOnly, cellSize))) {
                return xOnly;
            }
            if (!this.isBlocked(this.worldToGrid(yOnly, cellSize))) {
                return yOnly;
            }
            return this.drifter.position;
        }
        return proposed;
    }
    worldToGrid(position, cellSize) {
        if (!this.building) {
            return { x: 0, y: 0 };
        }
        return {
            x: Math.floor((position.x - this.building.position.x) / cellSize),
            y: Math.floor((position.y - this.building.position.y) / cellSize),
        };
    }
    isBlocked(gridPos) {
        if (!this.building) {
            return false;
        }
        if (!Grid.inBounds(gridPos, { width: this.building.collisionGrid[0]?.length ?? 0, height: this.building.collisionGrid.length })) {
            return true;
        }
        return this.building.collisionGrid[gridPos.y][gridPos.x];
    }
}
//# sourceMappingURL=MovementController.js.map