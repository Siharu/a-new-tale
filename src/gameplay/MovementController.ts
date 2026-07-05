import { Building, Direction, Drifter, Vector2, Zone } from '../types.js';
import { Grid, Vec2 } from '../utils.js';

export interface MovementControllerOptions {
  drifter: Drifter;
  zone: Zone;
  building: Building | null;
  movementSpeed?: number;
  bodySize?: number;
}

export class MovementController {
  private drifter: Drifter;
  private zone: Zone;
  private building: Building | null;
  private movementSpeed: number;
  private input: Vector2 = { x: 0, y: 0 };

  constructor(options: MovementControllerOptions) {
    this.drifter = options.drifter;
    this.zone = options.zone;
    this.building = options.building;
    this.movementSpeed = options.movementSpeed ?? 120;
  }

  public setBuilding(building: Building | null): void {
    this.building = building;
  }

  public setZone(zone: Zone): void {
    this.zone = zone;
  }

  public setInput(input: Vector2): void {
    this.input = {
      x: Math.max(-1, Math.min(1, input.x)),
      y: Math.max(-1, Math.min(1, input.y)),
    };

    if (this.input.x !== 0 || this.input.y !== 0) {
      this.updateFacing();
    }
  }

  public update(deltaSeconds: number): void {
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

  private updateFacing(): void {
    const input = this.input;
    if (Math.abs(input.x) > Math.abs(input.y)) {
      this.drifter.facing = input.x > 0 ? Direction.E : Direction.W;
    } else if (input.y !== 0) {
      this.drifter.facing = input.y > 0 ? Direction.S : Direction.N;
    }
  }

  private resolveCollision(proposed: Vector2): Vector2 {
    if (!this.building) {
      return this.clampToZone(proposed);
    }

    const candidate = this.resolveBuildingCollision(proposed);
    const clamped = this.clampToZone(candidate);
    return clamped;
  }

  private clampToZone(position: Vector2): Vector2 {
    return {
      x: Math.max(0, Math.min(position.x, this.zone.size.width)),
      y: Math.max(0, Math.min(position.y, this.zone.size.height)),
    };
  }

  private resolveBuildingCollision(proposed: Vector2): Vector2 {
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

  private worldToGrid(position: Vector2, cellSize: number): { x: number; y: number } {
    if (!this.building) {
      return { x: 0, y: 0 };
    }

    return {
      x: Math.floor((position.x - this.building.position.x) / cellSize),
      y: Math.floor((position.y - this.building.position.y) / cellSize),
    };
  }

  private isBlocked(gridPos: { x: number; y: number }): boolean {
    if (!this.building) {
      return false;
    }

    if (!Grid.inBounds(gridPos, { width: this.building.collisionGrid[0]?.length ?? 0, height: this.building.collisionGrid.length })) {
      return true;
    }

    return this.building.collisionGrid[gridPos.y][gridPos.x];
  }
}
