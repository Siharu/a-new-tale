/**
 * RainSystem
 * GPU point-sprite rain for the Drifter's Tale engine.
 *
 * Two distinct modes driven by weather/wrongness state:
 *
 *   REGULAR — ACID_RAIN weatherState or RAINY/STORMY wrongnessState.
 *     Fast-falling angled streaks, blue-grey tinted, moderate count.
 *     Particles are stretched along their fall direction in the vertex
 *     shader by writing a tall gl_PointSize (Y >> X), giving the classic
 *     streak look without needing a line geometry.
 *
 *   OBSEDIA — obsediaRain.active === true.
 *     Black oil rain / Moon Rain / Starfall. Distinct state, never mixed
 *     with regular rain — Obsedia overrides. Near-black particles,
 *     heavier, slower and more viscous than normal rain, slightly
 *     randomised fall angles so it reads as "gooey" not "sharp."
 *     Intensity field (0–1) scales count and opacity continuously.
 *
 * Splash sprites: a small pool of flat quads spawned at Y = groundY
 * when a streak wraps back to the top. Fade out quickly (0.12s).
 * Kept cheap — max 32 splashes alive at any time.
 *
 * Integration:
 *   const rain = new RainSystem({ groundY: 0 });
 *   rain.addToScene(isoRenderer.scene);
 *   GodRayLayer.hideDuringOcclusion(rain.getObject3D());
 *   GodRayLayer.hideDuringOcclusion(rain.getSplashObject3D());
 *   // each frame, after syncSky():
 *   rain.update(deltaTime, {
 *     weatherState: sky.weatherState,
 *     wrongnessState: sky.wrongnessState,
 *     obsediaActive: sky.obsediaRain.active,
 *     obsediaIntensity: sky.obsediaRain.intensity,
 *   });
 */

import * as THREE from 'three';
import { WeatherType, WrongnessState } from '../types.js';

// ── Vertex shader ─────────────────────────────────────────────────────────────
// Each particle stores its base position (aBasePos) and a per-particle seed
// for phase offset. The vertex shader computes current world position by
// advancing time, wrapping the Y coordinate, and applying a slight X lean
// (angle) so rain isn't perfectly vertical. gl_PointSize is made tall to
// produce a streak rather than a dot.

const RAIN_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uBoundsH;    // vertical extent particles fall through
  uniform float uBoundsXZ;   // half-extent of XZ spawn volume
  uniform float uSpeed;      // world units / second base fall speed
  uniform float uAngleX;     // world-space lean on X per unit fall (0 = vertical)
  uniform float uAngleZ;     // world-space lean on Z per unit fall
  uniform float uStreakH;    // streak height in pixels
  uniform float uStreakW;    // streak width in pixels
  uniform float uPixelRatio;
  uniform float uTopY;       // Y at which particles spawn (sky level)

  attribute vec3 aBasePos;   // stable XZ position + initial Y offset (0..boundsH)
  attribute float aSeed;     // 0..1 per-particle phase offset
  attribute float aSpeedMul; // 0.7..1.3 per-particle speed variation

  varying float vAlpha;
  varying float vSeed;

  void main() {
    float phase = mod(uTime * uSpeed * aSpeedMul + aSeed * uBoundsH, uBoundsH);
    float y = uTopY - phase;

    // lean: particle drifts slightly on X/Z as it falls, giving that
    // characteristic angled-streak look without needing line geometry
    float lean = phase;
    vec3 pos = vec3(
      aBasePos.x + lean * uAngleX,
      y,
      aBasePos.z + lean * uAngleZ
    );

    // wrap XZ so leaned particles re-enter the volume rather than drifting away
    pos.x = mod(pos.x + uBoundsXZ, uBoundsXZ * 2.0) - uBoundsXZ;
    pos.z = mod(pos.z + uBoundsXZ, uBoundsXZ * 2.0) - uBoundsXZ;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;

    // uStreakH/uStreakW are already literal pixel sizes (see options doc).
    // No distance-based scaling here — the camera is orthographic, so
    // apparent size does NOT change with depth. (A prior version applied a
    // "300.0 / dist" perspective-camera compensation trick that assumed a
    // ~300-unit camera distance; this project's camera sits ~30 units away,
    // so that formula was inflating every streak 7-15x — the giant vertical
    // bar bug.)
    gl_PointSize = uStreakH * uPixelRatio;

    // fade near top and bottom of the fall volume so wrapping is invisible
    float fadeEdge = min(phase / (uBoundsH * 0.08), 1.0) *
                     min((uBoundsH - phase) / (uBoundsH * 0.08), 1.0);
    vAlpha = fadeEdge;
    vSeed  = aSeed;
  }
`;

// ── Fragment shader ───────────────────────────────────────────────────────────
// Enforces a narrow aspect ratio on the point sprite to turn the square
// point into a tall thin streak. Pixels outside the streak width are discarded.

const RAIN_FRAGMENT = /* glsl */ `
  uniform vec3  uColor;
  uniform float uOpacity;
  uniform float uStreakAspect; // streakH / streakW — how tall vs wide

  varying float vAlpha;
  varying float vSeed;

  void main() {
    // remap gl_PointCoord so the point sprite is treated as uStreakAspect:1
    // tall by discarding pixels outside the narrow band
    vec2 pc = gl_PointCoord - 0.5;           // -0.5 .. 0.5
    float xFrac = abs(pc.x) * uStreakAspect; // scale X by aspect ratio
    if (xFrac > 0.5) discard;                // outside streak width

    // fade along the streak length (Y axis) — softer at tip and tail
    float yFade = 1.0 - abs(pc.y) * 2.0;
    yFade = pow(max(yFade, 0.0), 1.4);

    gl_FragColor = vec4(uColor, uOpacity * vAlpha * yFade);
  }
`;

// ── Splash geometry ───────────────────────────────────────────────────────────
// Simple flat ring quads at ground level. Kept in a separate Points object
// so they can be hidden during the god-ray occlusion pass independently.

const SPLASH_VERTEX = /* glsl */ `
  uniform float uPixelRatio;

  attribute float aLife;     // 0 = just spawned, 1 = dead (CPU-updated each frame)
  attribute float aSize;

  varying float vLife;

  void main() {
    vLife = aLife;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_Position  = projectionMatrix * mvPos;
    float dist   = max(-mvPos.z, 0.1);
    gl_PointSize = aSize * uPixelRatio * (300.0 / dist) * (1.0 - aLife * 0.5);
  }
`;

const SPLASH_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;

  varying float vLife;

  void main() {
    vec2 pc   = gl_PointCoord - 0.5;
    float r   = length(pc);
    // ring shape: bright at r~0.35, transparent inside and outside
    float ring = smoothstep(0.25, 0.35, r) * smoothstep(0.5, 0.4, r);
    float alpha = ring * (1.0 - vLife) * 0.7;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

// ─────────────────────────────────────────────────────────────────────────────

export interface RainSystemOptions {
  /** Y coordinate of the ground plane — splashes spawn here. Default 0. */
  groundY?: number;
  /** Half-extent of the XZ volume rain falls through. Default 14. */
  boundsXZ?: number;
  /** Vertical height of the rain column. Default 18. */
  boundsH?: number;
  /** Y at which rain particles spawn. Default groundY + boundsH. */
  topY?: number;
  /** Max particles for regular rain. Default 1800. */
  regularCount?: number;
  /** Max particles for Obsedia Rain. Default 2400. */
  obsediaCount?: number;
  /** Max simultaneous splash sprites. Default 32. */
  maxSplashes?: number;
}

export interface RainUpdateState {
  weatherState: WeatherType;
  wrongnessState: WrongnessState;
  obsediaActive: boolean;
  obsediaIntensity: number; // 0–1
}

// Which rain mode is active
type RainMode = 'none' | 'regular' | 'obsedia';

// Splash ring data kept CPU-side
interface Splash {
  x: number;
  z: number;
  life: number;   // 0 = just spawned, 1 = dead
  maxLife: number; // seconds
  size: number;
}

export class RainSystem {
  // ── Regular rain ─────────────────────────────────────────────────────────
  private regularPoints: THREE.Points;
  private regularGeo: THREE.BufferGeometry;
  private regularMat: THREE.ShaderMaterial;
  private regularCount: number;

  // ── Obsedia rain ──────────────────────────────────────────────────────────
  private obsediaPoints: THREE.Points;
  private obsediaGeo: THREE.BufferGeometry;
  private obsediaMat: THREE.ShaderMaterial;
  private obsediaCount: number;

  // ── Splashes ──────────────────────────────────────────────────────────────
  private splashPoints: THREE.Points;
  private splashGeo: THREE.BufferGeometry;
  private splashMat: THREE.ShaderMaterial;
  private splashPool: Splash[];
  private maxSplashes: number;
  // CPU-side buffers, written to BufferAttribute each frame
  private splashPositions: Float32Array;
  private splashLifeAttr: Float32Array;
  private splashSizeAttr: Float32Array;
  // next wrap timer per regular/obsedia particle (we use the wrap to fire a splash)
  private splashTimer = 0;
  private splashInterval = 0.04; // seconds between spawn attempts

  // ── Shared ────────────────────────────────────────────────────────────────
  private groundY: number;
  private boundsXZ: number;
  private boundsH: number;
  private topY: number;
  private currentMode: RainMode = 'none';
  private targetOpacity = 0;
  private currentOpacity = 0;
  private scene: THREE.Scene | null = null;

  constructor(options: RainSystemOptions = {}) {
    this.groundY  = options.groundY  ?? 0;
    this.boundsXZ = options.boundsXZ ?? 14;
    this.boundsH  = options.boundsH  ?? 18;
    this.topY     = options.topY     ?? (this.groundY + this.boundsH);
    this.regularCount = options.regularCount ?? 1800;
    this.obsediaCount = options.obsediaCount ?? 2400;
    this.maxSplashes  = options.maxSplashes  ?? 32;

    this.regularPoints = this.buildRainPoints(
      this.regularCount,
      /* color */ new THREE.Color(0x8aabcc),
      /* speed */ 14,
      /* angleX */ -0.06, /* angleZ */ 0.02,
      /* streakH */ 18, /* streakW */ 1.8,
      /* opacity */ 0.55,
      /* seed */ 0x1a2b3c,
    );
    this.regularGeo = this.regularPoints.geometry as THREE.BufferGeometry;
    this.regularMat = this.regularPoints.material as THREE.ShaderMaterial;

    this.obsediaPoints = this.buildRainPoints(
      this.obsediaCount,
      /* color */ new THREE.Color(0x050507),
      /* speed */ 9,
      /* angleX */ -0.03, /* angleZ */ 0.05,
      /* streakH */ 26, /* streakW */ 2.2,
      /* opacity */ 0.82,
      /* seed */ 0xdeadbeef,
    );
    this.obsediaGeo = this.obsediaPoints.geometry as THREE.BufferGeometry;
    this.obsediaMat = this.obsediaPoints.material as THREE.ShaderMaterial;

    // Splash pool
    this.maxSplashes = this.maxSplashes;
    this.splashPool = [];
    this.splashPositions = new Float32Array(this.maxSplashes * 3);
    this.splashLifeAttr  = new Float32Array(this.maxSplashes);
    this.splashSizeAttr  = new Float32Array(this.maxSplashes);
    for (let i = 0; i < this.maxSplashes; i++) {
      this.splashLifeAttr[i] = 1; // start dead
      this.splashPool.push({ x: 0, z: 0, life: 1, maxLife: 0.12, size: 6 });
    }

    this.splashGeo = new THREE.BufferGeometry();
    this.splashGeo.setAttribute('position', new THREE.BufferAttribute(this.splashPositions, 3));
    this.splashGeo.setAttribute('aLife', new THREE.BufferAttribute(this.splashLifeAttr, 1));
    this.splashGeo.setAttribute('aSize', new THREE.BufferAttribute(this.splashSizeAttr, 1));

    this.splashMat = new THREE.ShaderMaterial({
      vertexShader:   SPLASH_VERTEX,
      fragmentShader: SPLASH_FRAGMENT,
      uniforms: {
        uColor:      { value: new THREE.Color(0x8aabcc) },
        uPixelRatio: { value: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1 },
      },
      transparent: true,
      depthWrite:  false,
      blending:    THREE.NormalBlending,
    });
    this.splashPoints = new THREE.Points(this.splashGeo, this.splashMat);
    this.splashPoints.frustumCulled = false;
    this.splashPoints.visible = false;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Returns the regular rain Points — pass to GodRayLayer.hideDuringOcclusion(). */
  getObject3D(): THREE.Object3D {
    return this.regularPoints;
  }

  /** Returns the Obsedia rain Points — also hide during occlusion. */
  getObsediaObject3D(): THREE.Object3D {
    return this.obsediaPoints;
  }

  /** Returns the splash ring Points — also hide during occlusion. */
  getSplashObject3D(): THREE.Object3D {
    return this.splashPoints;
  }

  addToScene(scene: THREE.Scene): void {
    if (this.scene === scene) return;
    this.scene = scene;
    scene.add(this.regularPoints);
    scene.add(this.obsediaPoints);
    scene.add(this.splashPoints);
    // Start hidden — update() will show/hide based on state
    this.regularPoints.visible = false;
    this.obsediaPoints.visible = false;
  }

  removeFromScene(): void {
    if (!this.scene) return;
    this.scene.remove(this.regularPoints);
    this.scene.remove(this.obsediaPoints);
    this.scene.remove(this.splashPoints);
    this.scene = null;
  }

  /**
   * Call once per frame after IsometricRenderer.syncSky().
   * Determines active mode, fades opacity, ticks particle time uniforms,
   * and advances splash pool.
   */
  update(deltaTime: number, state: RainUpdateState): void {
    const mode = this.resolveMode(state);

    if (mode !== this.currentMode) {
      this.currentMode = mode;
      this.applyMode(mode, state.obsediaIntensity);
    }

    // smooth opacity fade in/out
    const fadeSpeed = 1.2;
    if (this.currentOpacity < this.targetOpacity) {
      this.currentOpacity = Math.min(this.targetOpacity, this.currentOpacity + fadeSpeed * deltaTime);
    } else if (this.currentOpacity > this.targetOpacity) {
      this.currentOpacity = Math.max(this.targetOpacity, this.currentOpacity - fadeSpeed * deltaTime);
    }

    // hide completely when faded out
    const visible = this.currentOpacity > 0.01;
    if (mode === 'obsedia') {
      this.obsediaPoints.visible = visible;
      this.regularPoints.visible = false;
      if (visible) {
        this.obsediaMat.uniforms.uOpacity.value = this.currentOpacity;
        this.tickTime(this.obsediaMat, deltaTime);
      }
    } else if (mode === 'regular') {
      this.regularPoints.visible = visible;
      this.obsediaPoints.visible = false;
      if (visible) {
        this.regularMat.uniforms.uOpacity.value = this.currentOpacity;
        this.tickTime(this.regularMat, deltaTime);
      }
    } else {
      this.regularPoints.visible = false;
      this.obsediaPoints.visible = false;
    }

    // splashes
    if (visible) {
      this.updateSplashes(deltaTime, mode, state.obsediaIntensity);
    } else {
      this.splashPoints.visible = false;
    }
  }

  dispose(): void {
    this.removeFromScene();
    this.regularGeo.dispose();
    this.regularMat.dispose();
    this.obsediaGeo.dispose();
    this.obsediaMat.dispose();
    this.splashGeo.dispose();
    this.splashMat.dispose();
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private resolveMode(state: RainUpdateState): RainMode {
    if (state.obsediaActive && state.obsediaIntensity > 0.05) return 'obsedia';
    const isRainWeather = state.weatherState === WeatherType.ACID_RAIN;
    const isRainWrongness = state.wrongnessState === WrongnessState.RAINY ||
                            state.wrongnessState === WrongnessState.STORMY;
    if (isRainWeather || isRainWrongness) return 'regular';
    return 'none';
  }

  private applyMode(mode: RainMode, obsediaIntensity: number): void {
    if (mode === 'obsedia') {
      this.targetOpacity = 0.55 + obsediaIntensity * 0.45;
      // Obsedia splashes are near-black
      (this.splashMat.uniforms.uColor.value as THREE.Color).set(0x0a0a0e);
    } else if (mode === 'regular') {
      this.targetOpacity = 0.7;
      (this.splashMat.uniforms.uColor.value as THREE.Color).set(0x8aabcc);
    } else {
      this.targetOpacity = 0;
    }
  }

  private tickTime(mat: THREE.ShaderMaterial, dt: number): void {
    mat.uniforms.uTime.value += dt;
  }

  private updateSplashes(dt: number, mode: RainMode, obsediaIntensity: number): void {
    // advance existing splashes
    for (let i = 0; i < this.maxSplashes; i++) {
      const s = this.splashPool[i];
      if (s.life < 1) {
        s.life = Math.min(1, s.life + dt / s.maxLife);
        this.splashLifeAttr[i] = s.life;
        this.splashPositions[i * 3 + 0] = s.x;
        this.splashPositions[i * 3 + 1] = this.groundY;
        this.splashPositions[i * 3 + 2] = s.z;
        this.splashSizeAttr[i] = s.size;
      }
    }

    // spawn new splashes on a timer
    this.splashTimer += dt;
    const interval = mode === 'obsedia'
      ? Math.max(0.018, this.splashInterval * (1 - obsediaIntensity * 0.6))
      : this.splashInterval;

    while (this.splashTimer >= interval) {
      this.splashTimer -= interval;
      // find a dead slot
      const slot = this.splashPool.findIndex(s => s.life >= 1);
      if (slot !== -1) {
        const s = this.splashPool[slot];
        s.x = (Math.random() * 2 - 1) * this.boundsXZ;
        s.z = (Math.random() * 2 - 1) * this.boundsXZ;
        s.life = 0;
        s.maxLife = mode === 'obsedia' ? 0.18 + Math.random() * 0.1 : 0.1 + Math.random() * 0.06;
        s.size = mode === 'obsedia' ? 7 + Math.random() * 5 : 4 + Math.random() * 4;
      }
    }

    // upload to GPU
    (this.splashGeo.getAttribute('aLife') as THREE.BufferAttribute).needsUpdate = true;
    (this.splashGeo.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
    (this.splashGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;

    const anySplashAlive = this.splashPool.some(s => s.life < 1);
    this.splashPoints.visible = anySplashAlive;
  }

  private buildRainPoints(
    count: number,
    color: THREE.Color,
    speed: number,
    angleX: number,
    angleZ: number,
    streakH: number,
    streakW: number,
    opacity: number,
    seed: number,
  ): THREE.Points {
    // Simple seeded LCG for stable initial positions
    let s = seed >>> 0;
    const rand = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };

    const basePos  = new Float32Array(count * 3);
    const seeds    = new Float32Array(count);
    const speedMul = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      basePos[i * 3 + 0] = (rand() * 2 - 1) * this.boundsXZ;
      basePos[i * 3 + 1] = this.groundY; // Y ignored in vertex shader; using aBasePos.xz only
      basePos[i * 3 + 2] = (rand() * 2 - 1) * this.boundsXZ;
      seeds[i]    = rand();
      speedMul[i] = 0.7 + rand() * 0.6;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('aBasePos',  new THREE.BufferAttribute(basePos,  3));
    geo.setAttribute('aSeed',     new THREE.BufferAttribute(seeds,    1));
    geo.setAttribute('aSpeedMul', new THREE.BufferAttribute(speedMul, 1));
    // dummy position attribute required by THREE internals
    geo.setAttribute('position',  new THREE.BufferAttribute(basePos.slice(), 3));

    const mat = new THREE.ShaderMaterial({
      vertexShader:   RAIN_VERTEX,
      fragmentShader: RAIN_FRAGMENT,
      uniforms: {
        uTime:        { value: 0 },
        uBoundsH:     { value: this.boundsH },
        uBoundsXZ:    { value: this.boundsXZ },
        uSpeed:       { value: speed },
        uAngleX:      { value: angleX },
        uAngleZ:      { value: angleZ },
        uStreakH:     { value: streakH },
        uStreakW:     { value: streakW },
        uStreakAspect:{ value: streakH / streakW },
        uPixelRatio:  { value: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1 },
        uTopY:        { value: this.topY },
        uColor:       { value: color.clone() },
        uOpacity:     { value: opacity },
      },
      transparent: true,
      depthWrite:  false,
      depthTest:   true,
      blending:    THREE.NormalBlending,
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    return points;
  }
}
