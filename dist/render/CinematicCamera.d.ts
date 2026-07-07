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
    target?: THREE.Vector3;
    radius?: number;
    height?: number;
    speedRadPerSec?: number;
    startAngle?: number;
    bobAmplitude?: number;
    bobSpeed?: number;
}
export interface FlyKeyframe {
    position: THREE.Vector3;
    lookAt: THREE.Vector3;
    duration: number;
    ease?: (t: number) => number;
}
export declare class CinematicCamera {
    private camera;
    private mode;
    private orbitOpts;
    private orbitAngle;
    private orbitElapsed;
    private path;
    private pathIndex;
    private pathElapsed;
    private pathFrom;
    private onPathComplete;
    constructor(camera: THREE.PerspectiveCamera);
    /** Start (or restart) a slow endless orbit. Safe to call repeatedly — e.g.
     *  re-entering the menu — resets phase each time for a consistent feel. */
    orbit(opts?: OrbitOptions): void;
    /** Play a scripted camera path (briefing intro etc). Calls onComplete once
     *  the final keyframe is reached; camera holds at the last frame after
     *  that until stop()/orbit()/flyPath() is called again. */
    flyPath(keyframes: FlyKeyframe[], onComplete?: () => void): void;
    /** Freeze the camera where it currently is — no more automatic movement
     *  until orbit()/flyPath() is called again. */
    stop(): void;
    update(deltaSeconds: number): void;
    private applyOrbitFrame;
    private updatePath;
    /** Best-effort reconstruction of where the camera is currently looking,
     *  used as the start point when flyPath() begins from an orbit/idle state
     *  (camera.rotation alone doesn't give us a clean lookAt target). */
    private currentLookAtGuess;
}
//# sourceMappingURL=CinematicCamera.d.ts.map