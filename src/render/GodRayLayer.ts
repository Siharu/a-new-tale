/**
 * GodRayLayer
 * Step 2.5 in the rendering build order (... -> LightingController ->
 * GodRayLayer -> DustParticles -> ...).
 *
 * Classic "GPU Gems crepuscular rays" technique, hand-rolled with a raw
 * THREE.ShaderMaterial rather than pulling in three/examples/postprocessing
 * — matches the existing convention set by PixelPipeline (manual render
 * target + full-screen quad blit, no external post stack).
 *
 * Two passes:
 *   1. Occlusion pass: render the scene as near-white sky / near-black
 *      silhouettes (only emissive/sky stays bright) into a small offscreen
 *      target, sized to PixelPipeline's internal resolution so cost stays
 *      cheap and the ray pattern matches the game's actual pixel grid
 *      rather than looking like a high-res overlay slapped on a low-res game.
 *   2. Radial blur pass: repeatedly sample that occlusion texture toward
 *      the light's screen-space position, accumulating a streak — this is
 *      what produces the beam look in reference image 2 and the shafts
 *      through the windows in image 4.
 * The result is additively blended onto the main render before
 * PixelPipeline.blitToScreen() upscales everything together, so god rays
 * inherit the same pixel-perfect nearest-neighbor look as the rest of the
 * scene rather than looking like a smooth modern overlay.
 *
 * Usage (inside IsometricRenderer.render(), after pixelPipeline.renderScene()
 * and before pixelPipeline.blitToScreen()):
 *   godRays.renderOcclusion(renderer, scene, camera, occlusionOverrideMaterial);
 *   godRays.composite(renderer, pixelPipeline.getRenderTarget(), lightScreenPos);
 */

import * as THREE from 'three';

const RADIAL_BLUR_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const RADIAL_BLUR_FRAGMENT = /* glsl */ `
  uniform sampler2D tOcclusion;
  uniform sampler2D tScene;
  uniform vec2 lightScreenPos;   // 0..1, can be off-screen (negative/>1) — still works
  uniform float exposure;
  uniform float decay;
  uniform float density;
  uniform float weight;
  uniform vec3 rayColor;
  uniform float intensity;       // overall mix strength, e.g. fades to 0 at night/heavy fog
  varying vec2 vUv;

  const int NUM_SAMPLES = 48;

  void main() {
    vec2 deltaTexCoord = (vUv - lightScreenPos);
    deltaTexCoord *= 1.0 / float(NUM_SAMPLES) * density;
    vec2 coord = vUv;
    float illuminationDecay = 1.0;
    vec3 accum = vec3(0.0);

    for (int i = 0; i < NUM_SAMPLES; i++) {
      coord -= deltaTexCoord;
      vec3 samp = texture2D(tOcclusion, coord).rgb;
      samp *= illuminationDecay * weight;
      accum += samp;
      illuminationDecay *= decay;
    }

    vec3 rays = accum * exposure * rayColor * intensity;
    vec3 base = texture2D(tScene, vUv).rgb;
    gl_FragColor = vec4(base + rays, 1.0);
  }
`;

export interface GodRayLayerOptions {
  width?: number;          // default matches PixelPipeline's internalWidth (384)
  height?: number;         // default matches PixelPipeline's internalHeight (216)
  exposure?: number;       // default 0.35
  decay?: number;          // default 0.96
  density?: number;        // default 0.85
  weight?: number;         // default 0.4
  rayColor?: THREE.Color;  // default warm near-white, overridden per-bake from SkySystem's sunMoon color
}

export class GodRayLayer {
  private width: number;
  private height: number;

  private occlusionTarget: THREE.WebGLRenderTarget;
  private occlusionOverrideMaterial: THREE.MeshBasicMaterial; // forces silhouettes black, used as scene.overrideMaterial
  private skyOcclusionExemptTag = 'godrayOcclusionExempt'; // userData flag — sky dome / emissive elements skip the override
  private occlusionHideTag = 'godrayHideDuringOcclusion'; // userData flag — non-Mesh additive effects (DustParticles' THREE.Points,
                                                            // sprites, etc.) get temporarily hidden rather than material-swapped,
                                                            // since the override-material approach only applies to Mesh objects
                                                            // and additive Points would otherwise render straight into the
                                                            // occlusion mask as noise instead of being properly excluded

  private compositeTarget: THREE.WebGLRenderTarget;
  private compositeScene: THREE.Scene;
  private compositeCamera: THREE.OrthographicCamera;
  private compositeMesh: THREE.Mesh;
  private compositeMaterial: THREE.ShaderMaterial;

  intensity: number = 1.0; // public knob — drive this from fog/weather (e.g. fade out in FOG_HEAVY)

  constructor(options: GodRayLayerOptions = {}) {
    this.width = options.width ?? 384;
    this.height = options.height ?? 216;

    this.occlusionTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    });

    this.occlusionOverrideMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

    this.compositeTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      colorSpace: THREE.SRGBColorSpace,
    });

    this.compositeMaterial = new THREE.ShaderMaterial({
      vertexShader: RADIAL_BLUR_VERTEX,
      fragmentShader: RADIAL_BLUR_FRAGMENT,
      uniforms: {
        tOcclusion: { value: this.occlusionTarget.texture },
        tScene: { value: null },
        lightScreenPos: { value: new THREE.Vector2(0.5, 0.3) },
        exposure: { value: options.exposure ?? 0.35 },
        decay: { value: options.decay ?? 0.96 },
        density: { value: options.density ?? 0.85 },
        weight: { value: options.weight ?? 0.4 },
        rayColor: { value: (options.rayColor ?? new THREE.Color(0xfff3d6)).clone() },
        intensity: { value: 1.0 },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.compositeScene = new THREE.Scene();
    this.compositeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.compositeMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.compositeMaterial);
    this.compositeScene.add(this.compositeMesh);
  }

  /**
   * Tag a mesh (e.g. the sky dome, or any emissive element) so the
   * occlusion pass renders it as bright/transparent rather than a black
   * silhouette — without this, the sky dome itself would block its own
   * light source's rays at the source, which defeats the effect.
   */
  static exemptFromOcclusion(mesh: THREE.Object3D): void {
    mesh.userData.godrayOcclusionExempt = true;
  }

  /**
   * Tag a non-Mesh additive effect (DustParticles' THREE.Points, future
   * sprite-based effects, etc.) to be temporarily hidden during the
   * occlusion pass rather than material-swapped — see occlusionHideTag
   * above for why Points need different handling than Mesh silhouettes.
   */
  static hideDuringOcclusion(object: THREE.Object3D): void {
    object.userData.godrayHideDuringOcclusion = true;
  }

  /** Update the ray tint to match the current sun/moon glow color from SkySystem, for cohesion with the sky bake. */
  setRayColor(color: THREE.Color): void {
    (this.compositeMaterial.uniforms.rayColor.value as THREE.Color).copy(color);
  }

  /**
   * Pass 1: render the scene with all real materials swapped for solid
   * black, EXCEPT meshes tagged via exemptFromOcclusion() (the sky dome),
   * which render as their actual bright texture. This produces a
   * black-silhouettes-on-bright-sky mask that the radial blur then streaks
   * outward from the light position.
   */
  renderOcclusion(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    const swapped: { mesh: THREE.Mesh; original: THREE.Material | THREE.Material[] }[] = [];
    const hidden: THREE.Object3D[] = [];

    scene.traverse((obj) => {
      if (obj.userData[this.occlusionHideTag]) {
        if (obj.visible) {
          obj.visible = false;
          hidden.push(obj);
        }
        return;
      }
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.userData[this.skyOcclusionExemptTag]) return; // left as-is — renders bright
      swapped.push({ mesh, original: mesh.material });
      mesh.material = this.occlusionOverrideMaterial;
    });

    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.occlusionTarget);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(prevTarget);

    for (const { mesh, original } of swapped) {
      mesh.material = original;
    }
    for (const obj of hidden) {
      obj.visible = true;
    }
  }

  /**
   * Pass 2: radial-blur the occlusion mask toward the light's screen
   * position and additively composite onto the already-rendered scene
   * texture (PixelPipeline's render target), writing into this layer's own
   * compositeTarget. Caller is responsible for blitting compositeTarget's
   * texture to screen instead of PixelPipeline's raw target afterward.
   *
   * @param sceneTexture     PixelPipeline.getRenderTarget().texture — the
   *                         normal lit/shaded scene render for this frame.
   * @param lightScreenPos01 light's position in 0..1 screen space (NDC * 0.5
   *                         + 0.5). Can be outside [0,1] — rays still read
   *                         correctly streaming in from off-screen, which
   *                         matters for low sun angles near the camera edge.
   */
  composite(
    renderer: THREE.WebGLRenderer,
    sceneTexture: THREE.Texture,
    lightScreenPos01: THREE.Vector2
  ): void {
    this.compositeMaterial.uniforms.tScene.value = sceneTexture;
    (this.compositeMaterial.uniforms.lightScreenPos.value as THREE.Vector2).copy(lightScreenPos01);
    this.compositeMaterial.uniforms.intensity.value = this.intensity;

    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.compositeTarget);
    renderer.render(this.compositeScene, this.compositeCamera);
    renderer.setRenderTarget(prevTarget);
  }

  /** Final composited (scene + rays) texture — blit this instead of PixelPipeline's raw target. */
  getOutputTexture(): THREE.Texture {
    return this.compositeTarget.texture;
  }

  /**
   * Projects a world-space light position (e.g. SkySystem's directional
   * light position, or a point far along its direction) into the 0..1
   * screen-space coordinate composite() expects.
   */
  static worldToScreen01(worldPos: THREE.Vector3, camera: THREE.Camera): THREE.Vector2 {
    const ndc = worldPos.clone().project(camera);
    return new THREE.Vector2((ndc.x + 1) / 2, (ndc.y + 1) / 2);
  }

  handleResize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.occlusionTarget.setSize(width, height);
    this.compositeTarget.setSize(width, height);
  }

  dispose(): void {
    this.occlusionTarget.dispose();
    this.compositeTarget.dispose();
    this.occlusionOverrideMaterial.dispose();
    this.compositeMaterial.dispose();
    this.compositeMesh.geometry.dispose();
  }
}
