/**
 * IsometricRenderer
 * Owns the fixed-pitch, non-rotating orthographic isometric camera and the
 * main game scene. Delegates resolution/upscale to PixelPipeline, shadow
 * setup to LightingController, and crepuscular rays to GodRayLayer (kept
 * separate per DRIFTER_ENGINE_PLAN.md's class list / rendering deep-dive
 * build order 2.1–2.8) — this class wires them together rather than
 * reimplementing any of their concerns inline.
 *
 * v2 — integrates step 2.4 (LightingController) and 2.5 (GodRayLayer) on
 * top of the v1 M2 scope (empty scene + sky). Both are attached
 * automatically inside attachSky() since they depend on the same
 * directional light SkySystem produces; nothing else changes about how a
 * caller uses this class versus v1 — attachSky()/syncSky()/render() still
 * the only required calls.
 *
 * Camera: classic 2:1 "game isometric" — 45° yaw, ~35.264° pitch (true
 * isometric, matches Octopath/HD-2D convention) rather than an actual 45°
 * pitch, which reads as too steep/top-down for this style. Fixed — no
 * rotation, per the locked DRIFTER lore/build decisions (non-rotating
 * camera was an explicit call in the player sprite system too).
 */

import * as THREE from 'three';
import { PixelPipeline, type PixelPipelineOptions } from './PixelPipeline.js';
import { LightingController, type LightingControllerOptions } from './LightingController.js';
import { GodRayLayer, type GodRayLayerOptions } from './GodRayLayer.js';
import { DustParticles, type DustParticlesOptions } from './DustParticles.js';
import { RainSystem, type RainSystemOptions } from './RainSystem.js';
import { AtmosphereController } from './AtmosphereController.js';
import type { SkySystem } from './SkySystem.js';

const ISO_YAW_DEG = 45;
const ISO_PITCH_DEG = 35.264; // true isometric angle (atan(1/sqrt(2)))

// Light position Y range produced by SkySystem.getDirectionalLight() —
// y = (1 - sunY) * 15 + 2, so this spans roughly [2, 17]. Used to derive a
// 0..1 elevation for LightingController.update() without SkySystem needing
// to expose elevation as its own field.
const LIGHT_Y_MIN = 2;
const LIGHT_Y_MAX = 17;

export interface IsometricRendererOptions {
  canvas: HTMLCanvasElement;
  viewSize?: number;             // world units visible vertically, default 10
  cameraDistance?: number;       // default 30 (just needs to clear the scene)
  pixelPipeline?: PixelPipelineOptions;
  lighting?: LightingControllerOptions;
  godRays?: GodRayLayerOptions;
  dustParticles?: DustParticlesOptions;
  rainSystem?: RainSystemOptions;
  enableGodRays?: boolean;       // default true — set false to skip the extra passes entirely (e.g. low-end fallback)
  enableDustParticles?: boolean; // default true
  enableAtmosphere?: boolean;    // default true — set false to skip the CSS overlay layer (e.g. it requires a DOM parent element, unavailable in some test harnesses)
}

export class IsometricRenderer {
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly pixelPipeline: PixelPipeline;
  readonly lightingController: LightingController;
  readonly godRayLayer: GodRayLayer;
  readonly dustParticles: DustParticles;
  readonly rainSystem: RainSystem;
  readonly atmosphereController: AtmosphereController | null;

  private canvas: HTMLCanvasElement;
  private viewSize: number;
  private cameraDistance: number;
  private skyDome: THREE.Mesh | null = null;
  private ambientLight: THREE.AmbientLight;
  private directionalLight: THREE.DirectionalLight | null = null;
  private attachedSky: SkySystem | null = null;
  private godRaysEnabled: boolean;
  private dustEnabled: boolean;
  private decayLevel: number = 0; // settable via setDecayLevel() — Zone-level decay, not derivable from SkySystem alone since it's a world-content concern, not a sky-bake input

  constructor(options: IsometricRendererOptions) {
    this.canvas = options.canvas;
    this.viewSize = options.viewSize ?? 10;
    this.cameraDistance = options.cameraDistance ?? 30;
    this.godRaysEnabled = options.enableGodRays ?? true;
    this.dustEnabled = options.enableDustParticles ?? true;

    this.scene = new THREE.Scene();

    const aspect = this.canvas.clientWidth / this.canvas.clientHeight || 16 / 9;
    this.camera = this.buildIsoCamera(aspect);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.pixelPipeline = new PixelPipeline(options.pixelPipeline);
    this.lightingController = new LightingController(this.renderer, options.lighting);
    this.godRayLayer = new GodRayLayer({
      width: this.pixelPipeline.internalWidth,
      height: this.pixelPipeline.internalHeight,
      ...options.godRays,
    });
    this.dustParticles = new DustParticles({
      bounds: this.viewSize * 1.5,
      ...options.dustParticles,
    });
    // DustParticles is THREE.Points, not Mesh — GodRayLayer's material-swap
    // occlusion pass only touches Mesh objects already, but its additive
    // shader would still render straight into the occlusion mask as noise
    // unless explicitly hidden for that one pass. See GodRayLayer's
    // hideDuringOcclusion() doc comment for the full reasoning.
    GodRayLayer.hideDuringOcclusion(this.dustParticles.getObject3D());
    this.dustParticles.addToScene(this.scene);

    this.rainSystem = new RainSystem({
      groundY: 0,
      boundsXZ: this.viewSize * 1.8,
      boundsH: this.viewSize * 2.2,
      ...options.rainSystem,
    });
    this.rainSystem.addToScene(this.scene);
    GodRayLayer.hideDuringOcclusion(this.rainSystem.getObject3D());
    GodRayLayer.hideDuringOcclusion(this.rainSystem.getObsediaObject3D());
    GodRayLayer.hideDuringOcclusion(this.rainSystem.getSplashObject3D());

    if ((options.enableAtmosphere ?? true) && this.canvas.parentElement) {
      this.atmosphereController = new AtmosphereController(this.canvas.parentElement);
    } else {
      this.atmosphereController = null; // either disabled, or canvas isn't attached to a parent yet —
                                         // caller can construct one manually later if needed since the
                                         // class is exported standalone
    }

    // Minimal default lighting so geometry is visible before a SkySystem
    // is attached; attachSky() replaces these colors/intensities.
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambientLight);

    this.handleResize();
  }

  private buildIsoCamera(aspect: number): THREE.OrthographicCamera {
    const halfH = this.viewSize / 2;
    const halfW = halfH * aspect;
    const camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 1000);

    const yaw = THREE.MathUtils.degToRad(ISO_YAW_DEG);
    const pitch = THREE.MathUtils.degToRad(ISO_PITCH_DEG);
    const d = this.cameraDistance;

    // Standard isometric placement: equal distance on X/Z, elevated on Y.
    const x = d * Math.cos(pitch) * Math.sin(yaw);
    const y = d * Math.sin(pitch);
    const z = d * Math.cos(pitch) * Math.cos(yaw);
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);

    return camera;
  }

  /**
   * Wires a SkySystem in as the single source of truth for ambient/fog
   * color and the background dome, per the locked architecture decision.
   * Also attaches LightingController (shadow casting on the key light) and
   * exempts the sky dome from GodRayLayer's occlusion pass — without that
   * exemption the dome would block its own light source at the source,
   * defeating the ray effect entirely.
   * Call once after both are constructed, then call syncSky() each frame
   * (or whenever the sky bakes a new texture/light state) to keep them
   * in sync — SkySystem.update() must be called separately beforehand.
   */
  attachSky(sky: SkySystem): void {
    this.attachedSky = sky;

    if (!this.skyDome) {
      // Large plane behind the scene, not a literal dome — fine for a
      // fixed-pitch non-rotating camera (locked decision: no rotation,
      // same call made for the player sprite system) where the dome's
      // edges are never visible. Positioned once, facing the camera —
      // it never needs to move again since the camera angle is fixed.
      const domeSize = this.viewSize * 12;
      const geometry = new THREE.PlaneGeometry(domeSize, domeSize);
      const material = new THREE.MeshBasicMaterial({
        map: sky.getTexture(),
        depthWrite: false,
        depthTest: false,
        fog: false,
      });
      this.skyDome = new THREE.Mesh(geometry, material);
      this.skyDome.renderOrder = -1000; // always drawn first/behind
      this.skyDome.position.set(0, this.viewSize * 0.5, -this.viewSize * 4);
      this.skyDome.lookAt(this.camera.position);
      this.scene.add(this.skyDome);
      GodRayLayer.exemptFromOcclusion(this.skyDome);
    }

    if (!this.directionalLight) {
      this.directionalLight = sky.getDirectionalLight();
      this.scene.add(this.directionalLight);
      this.lightingController.attach(this.scene, this.directionalLight, this.camera);
      this.lightingController.fitToScene(this.viewSize * 1.5);
    }

    this.scene.fog = new THREE.Fog(sky.fogColor.getHex(), this.cameraDistance * 0.6, this.cameraDistance * 2.2);

    this.syncSky();
  }

  /**
   * Call each frame after sky.update() to push the latest bake into the
   * renderer. deltaTime drives DustParticles' drift animation — pass 0 if
   * called outside a normal per-frame loop (e.g. a one-off debug refresh);
   * dust simply won't visibly drift that frame, nothing else breaks.
   */
  syncSky(deltaTime: number = 0): void {
    if (!this.attachedSky) return;
    const sky = this.attachedSky;

    this.ambientLight.color.copy(sky.getAmbientLight());

    if (this.directionalLight) {
      const fresh = sky.getDirectionalLight();
      this.directionalLight.color.copy(fresh.color);
      this.directionalLight.intensity = fresh.intensity;
      this.directionalLight.position.copy(fresh.position);

      // Derive a 0..1 elevation from the light's Y position (see
      // LIGHT_Y_MIN/MAX above) and feed LightingController so shadow
      // length/softness tracks dawn/dusk vs noon automatically.
      const elevation01 = THREE.MathUtils.clamp(
        (this.directionalLight.position.y - LIGHT_Y_MIN) / (LIGHT_Y_MAX - LIGHT_Y_MIN),
        0,
        1
      );
      // SkySystem sets intensity 0.35 at night vs 1.0 in daylight (see
      // getDirectionalLight()) — reuse that threshold rather than adding
      // a second isNight channel SkySystem would need to expose separately.
      const isNight = fresh.intensity < 0.5;
      this.lightingController.update(elevation01, isNight);
      this.godRayLayer.setRayColor(this.directionalLight.color);
      if (this.dustEnabled) {
        this.dustParticles.update(deltaTime, this.directionalLight.position, this.directionalLight.color, sky.getFogIntensity());
      }

      // Rain — driven by weather + wrongness + Obsedia state
      const rainState = {
        weatherState: sky.weatherState,
        wrongnessState: sky.wrongnessState,
        obsediaActive: sky.obsediaRain.active,
        obsediaIntensity: sky.obsediaRain.intensity,
      };
      this.rainSystem.update(deltaTime, rainState);

      // Suppress dust motes while rain is active (rain replaces ambient scatter)
      const rainActive = sky.obsediaRain.active ||
        sky.weatherState === 'ACID_RAIN' ||
        sky.wrongnessState === 'RAINY' ||
        sky.wrongnessState === 'STORMY';
      if (rainActive && this.dustEnabled) {
        this.dustParticles.setOpacity(0);
      } else if (this.dustEnabled) {
        // restore — DustParticles.update() will set the correct value next frame
      }
    }

    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(sky.fogColor);
    }

    this.renderer.setClearColor(sky.fogColor);

    if (this.atmosphereController) {
      this.atmosphereController.update(
        {
          wrongnessState: sky.wrongnessState,
          weatherState: sky.weatherState,
          obsediaRainActive: sky.obsediaRain.active,
          obsediaRainIntensity: sky.obsediaRain.intensity,
          decayLevel: this.decayLevel,
        },
        deltaTime
      );
    }
  }

  /** Set the current zone's decayLevel (0–1) — drives AtmosphereController's vignette strength. Call on zone change/load; not derived automatically since it's Zone/world-content state, not part of SkySystem's bake inputs. */
  setDecayLevel(value: number): void {
    this.decayLevel = THREE.MathUtils.clamp(value, 0, 1);
  }

  /**
   * Renders the scene through PixelPipeline (low-res bake), then — if god
   * rays are enabled and a sky/light is attached — runs GodRayLayer's
   * occlusion + radial-blur passes and blits ITS composited output instead
   * of the raw scene texture. Falls back to the plain PixelPipeline blit
   * when god rays are disabled or no directional light exists yet (e.g.
   * attachSky() hasn't been called), so this is always safe to call.
   */
  render(): void {
    this.pixelPipeline.renderScene(this.renderer, this.scene, this.camera);

    if (this.godRaysEnabled && this.directionalLight) {
      const lightScreenPos = GodRayLayer.worldToScreen01(this.directionalLight.position, this.camera);
      this.godRayLayer.renderOcclusion(this.renderer, this.scene, this.camera);
      this.godRayLayer.composite(this.renderer, this.pixelPipeline.getRenderTarget().texture, lightScreenPos);
      this.pixelPipeline.blitTextureToScreen(
        this.renderer,
        this.godRayLayer.getOutputTexture(),
        this.canvas.clientWidth,
        this.canvas.clientHeight
      );
    } else {
      this.pixelPipeline.blitToScreen(this.renderer, this.canvas.clientWidth, this.canvas.clientHeight);
    }
  }

  /** Toggle god rays at runtime (e.g. quality settings, or auto-disable during HUSK_NEST combat for clarity). */
  setGodRaysEnabled(enabled: boolean): void {
    this.godRaysEnabled = enabled;
  }

  /** Toggle dust motes at runtime (e.g. disable indoors via Zone/Room type, or during Obsedia Rain where falling streaks replace ambient dust). */
  setDustParticlesEnabled(enabled: boolean): void {
    this.dustEnabled = enabled;
    this.dustParticles.getObject3D().visible = enabled;
  }

  /** Call on window resize / canvas size change. */
  handleResize(): void {
    const width = this.canvas.clientWidth || this.canvas.width || 1;
    const height = this.canvas.clientHeight || this.canvas.height || 1;
    const aspect = width / height;

    const halfH = this.viewSize / 2;
    const halfW = halfH * aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height, false);
    // Internal/offscreen target resolutions (PixelPipeline, GodRayLayer)
    // deliberately do NOT change on resize — only the final blit scale
    // does. Resizing the internal res would defeat the fixed pixel-grid
    // look the whole pipeline exists to produce.
  }

  dispose(): void {
    this.pixelPipeline.dispose();
    this.lightingController.dispose();
    this.godRayLayer.dispose();
    this.dustParticles.dispose();
    this.rainSystem.dispose();
    this.atmosphereController?.dispose();
    this.renderer.dispose();
    if (this.skyDome) {
      this.skyDome.geometry.dispose();
      (this.skyDome.material as THREE.Material).dispose();
    }
  }
}
