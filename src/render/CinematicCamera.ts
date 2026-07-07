/**
 * CinematicCamera
 * Drives IsometricRenderer.cinematicCamera for non-gameplay views — menu
 * backdrop ambiance and scripted briefing flythroughs. Entirely separate
 * from gameplay: never touches MovementController, ZoneStreamer, or the
 * fixed iso camera. AppShell/MenuScreen own the lifecycle (start on
 * menu/briefing/loading, stop + IsometricRenderer.useIsoCamera() on play).
 *
 * Two modes:
 *  - orbit(): slow, endless drift around a target point. Good default for
 *    menu backdrops — never needs authored content.
 *  - flyPath(): scripted keyframes (position + lookAt + duration), eased,
 *    for authored briefing intros. Resolves when the path finishes.
 */

import * as THREE from 'three';

export interface OrbitOptions {
  target?: THREE.Vector3;   // point to orbit around, default origin
  radius?: number;          // default 16
  height?: number;          // camera Y above target, default 6
  speedRadPerSec?: number;  // default 0.05 (~2 min per revolution)
  startAngle?: number;      // radians, default 0
  bobAmplitude?: number;    // vertical bob height, default 0.4
  bobSpeed?: number;        // radians/sec, default 0.3
}

export interface FlyKeyframe {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  duration: number; // seconds to *arrive* at this keyframe from the previous one
  ease?: (t: number) => number; // default smoothstep
}

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

export class CinematicCamera {
  private camera: THREE.PerspectiveCamera;

  private mode: 'idle' | 'orbit' | 'path' = 'idle';
  private orbitOpts: Required<OrbitOptions> | null = null;
  private orbitAngle = 0;
  private orbitElapsed = 0;

  private path: FlyKeyframe[] = [];
  private pathIndex = 0;
  private pathElapsed = 0;
  private pathFrom: { position: THREE.Vector3; lookAt: THREE.Vector3 } | null = null;
  private onPathComplete: (() => void) | null = null;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  /** Start (or restart) a slow endless orbit. Safe to call repeatedly — e.g.
   *  re-entering the menu — resets phase each time for a consistent feel. */
  orbit(opts: OrbitOptions = {}): void {
    this.orbitOpts = {
      target: opts.target ?? new THREE.Vector3(0, 0, 0),
      radius: opts.radius ?? 16,
      height: opts.height ?? 6,
      speedRadPerSec: opts.speedRadPerSec ?? 0.05,
      startAngle: opts.startAngle ?? 0,
      bobAmplitude: opts.bobAmplitude ?? 0.4,
      bobSpeed: opts.bobSpeed ?? 0.3,
    };
    this.orbitAngle = this.orbitOpts.startAngle;
    this.orbitElapsed = 0;
    this.mode = 'orbit';
    this.applyOrbitFrame(); // avoid a one-frame pop before the first update()
  }

  /** Play a scripted camera path (briefing intro etc). Calls onComplete once
   *  the final keyframe is reached; camera holds at the last frame after
   *  that until stop()/orbit()/flyPath() is called again. */
  flyPath(keyframes: FlyKeyframe[], onComplete?: () => void): void {
    if (keyframes.length === 0) return;
    this.path = keyframes;
    this.pathIndex = 0;
    this.pathElapsed = 0;
    this.pathFrom = {
      position: this.camera.position.clone(),
      lookAt: this.currentLookAtGuess(),
    };
    this.onPathComplete = onComplete ?? null;
    this.mode = 'path';
  }

  /** Freeze the camera where it currently is — no more automatic movement
   *  until orbit()/flyPath() is called again. */
  stop(): void {
    this.mode = 'idle';
  }

  update(deltaSeconds: number): void {
    if (this.mode === 'orbit') {
      this.orbitElapsed += deltaSeconds;
      this.orbitAngle += (this.orbitOpts!.speedRadPerSec) * deltaSeconds;
      this.applyOrbitFrame();
    } else if (this.mode === 'path') {
      this.updatePath(deltaSeconds);
    }
  }

  private applyOrbitFrame(): void {
    const o = this.orbitOpts!;
    const bob = Math.sin(this.orbitElapsed * o.bobSpeed) * o.bobAmplitude;
    this.camera.position.set(
      o.target.x + Math.cos(this.orbitAngle) * o.radius,
      o.target.y + o.height + bob,
      o.target.z + Math.sin(this.orbitAngle) * o.radius
    );
    this.camera.lookAt(o.target);
  }

  private updatePath(deltaSeconds: number): void {
    const kf = this.path[this.pathIndex];
    if (!kf || !this.pathFrom) return;

    this.pathElapsed += deltaSeconds;
    const t = kf.duration > 0 ? THREE.MathUtils.clamp(this.pathElapsed / kf.duration, 0, 1) : 1;
    const eased = (kf.ease ?? smoothstep)(t);

    this.camera.position.lerpVectors(this.pathFrom.position, kf.position, eased);
    const lookAt = this.pathFrom.lookAt.clone().lerp(kf.lookAt, eased);
    this.camera.lookAt(lookAt);

    if (t >= 1) {
      this.pathIndex += 1;
      this.pathElapsed = 0;
      if (this.pathIndex >= this.path.length) {
        this.mode = 'idle';
        const cb = this.onPathComplete;
        this.onPathComplete = null;
        cb?.();
      } else {
        this.pathFrom = { position: kf.position.clone(), lookAt: kf.lookAt.clone() };
      }
    }
  }

  /** Best-effort reconstruction of where the camera is currently looking,
   *  used as the start point when flyPath() begins from an orbit/idle state
   *  (camera.rotation alone doesn't give us a clean lookAt target). */
  private currentLookAtGuess(): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    return this.camera.position.clone().add(dir.multiplyScalar(10));
  }
}
