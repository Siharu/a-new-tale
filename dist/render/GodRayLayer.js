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
 *   godRays.renderOcclusion(renderer, scene, camera, lightScreenPos);
 *   godRays.composite(renderer, pixelPipeline.getRenderTarget(), lightScreenPos);
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
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
// Injects a small bright disc into the occlusion buffer at the light's
// screen position — this is the actual "light source" the radial blur
// streaks outward from. Classic crepuscular-ray implementations (mrdoob's
// original godrays example, GPU Gems) render the WHOLE scene as black
// silhouettes and rely on exactly this kind of small fake-sun spot; they
// do NOT exempt the sky/background itself, since anything bright over a
// large screen area (like a full sky dome) reads as "light source" during
// the radial blur and washes the entire frame instead of producing shafts.
const SUN_DISC_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;
const SUN_DISC_FRAGMENT = /* glsl */ `
  uniform vec2 sunScreenPos;
  uniform float sunRadius;
  uniform vec3 sunColor;
  varying vec2 vUv;
  void main() {
    float d = distance(vUv, sunScreenPos);
    float disc = smoothstep(sunRadius, sunRadius * 0.3, d);
    gl_FragColor = vec4(sunColor * disc, disc);
  }
`;
export class GodRayLayer {
    constructor(options = {}) {
        this.occlusionHideTag = 'godrayHideDuringOcclusion'; // userData flag — non-Mesh additive effects (DustParticles' THREE.Points,
        this.intensity = 1.0; // public knob — drive this from fog/weather (e.g. fade out in FOG_HEAVY)
        this.width = options.width ?? 384;
        this.height = options.height ?? 216;
        this.occlusionTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            generateMipmaps: false,
        });
        this.occlusionOverrideMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        this.sunDiscMaterial = new THREE.ShaderMaterial({
            vertexShader: SUN_DISC_VERTEX,
            fragmentShader: SUN_DISC_FRAGMENT,
            uniforms: {
                sunScreenPos: { value: new THREE.Vector2(0.5, 0.3) },
                sunRadius: { value: options.sunRadius ?? 0.06 },
                sunColor: { value: (options.rayColor ?? new THREE.Color(0xfff3d6)).clone() },
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            depthWrite: false,
        });
        this.sunDiscScene = new THREE.Scene();
        this.sunDiscCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.sunDiscMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.sunDiscMaterial);
        this.sunDiscScene.add(this.sunDiscMesh);
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
                decay: { value: options.decay ?? 0.94 },
                density: { value: options.density ?? 0.7 },
                weight: { value: options.weight ?? 0.35 },
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
     * Tag a non-Mesh additive effect (DustParticles' THREE.Points, future
     * sprite-based effects, etc.) to be temporarily hidden during the
     * occlusion pass rather than material-swapped — see occlusionHideTag
     * above for why Points need different handling than Mesh silhouettes.
     */
    static hideDuringOcclusion(object) {
        object.userData.godrayHideDuringOcclusion = true;
    }
    /** Update the ray tint to match the current sun/moon glow color from SkySystem, for cohesion with the sky bake. Drives both the radial-blur streak color and the injected sun-disc color so they read as one light source. */
    setRayColor(color) {
        this.compositeMaterial.uniforms.rayColor.value.copy(color);
        this.sunDiscMaterial.uniforms.sunColor.value.copy(color);
    }
    /**
     * Pass 1: render the scene with all real materials swapped for solid
     * black (nothing is exempted — the sky dome included, since exempting a
     * screen-filling background was the root cause of the old wash-out bug,
     * see class doc comment). Then inject a small bright disc at the
     * light's screen position — this is the actual "sun" the radial blur
     * streaks outward from, matching the classic crepuscular-ray reference
     * implementation (mrdoob's original godrays example uses the same
     * black-silhouette-scene + separate fake-sun-spot split).
     */
    renderOcclusion(renderer, scene, camera, lightScreenPos) {
        const swapped = [];
        const hidden = [];
        scene.traverse((obj) => {
            if (obj.userData[this.occlusionHideTag]) {
                if (obj.visible) {
                    obj.visible = false;
                    hidden.push(obj);
                }
                return;
            }
            const mesh = obj;
            if (!mesh.isMesh)
                return;
            swapped.push({ mesh, original: mesh.material });
            mesh.material = this.occlusionOverrideMaterial;
        });
        const prevTarget = renderer.getRenderTarget();
        const prevAutoClear = renderer.autoClear;
        renderer.setRenderTarget(this.occlusionTarget);
        renderer.setClearColor(0x000000, 1); // black = "no direct light" default; only the sun disc below should read as bright
        renderer.autoClear = true;
        renderer.clear();
        renderer.render(scene, camera);
        // Inject the fake-sun disc additively on top, without clearing, so it
        // layers onto the black silhouette buffer rather than replacing it.
        this.sunDiscMaterial.uniforms.sunScreenPos.value.copy(lightScreenPos);
        renderer.autoClear = false;
        renderer.render(this.sunDiscScene, this.sunDiscCamera);
        renderer.autoClear = prevAutoClear;
        renderer.setRenderTarget(prevTarget);
        renderer.setClearColor(0x000000, 1); // restore — caller (IsometricRenderer) expects black default; PixelPipeline sets its own clear anyway but be explicit
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
    composite(renderer, sceneTexture, lightScreenPos01) {
        this.compositeMaterial.uniforms.tScene.value = sceneTexture;
        this.compositeMaterial.uniforms.lightScreenPos.value.copy(lightScreenPos01);
        this.compositeMaterial.uniforms.intensity.value = this.intensity;
        const prevTarget = renderer.getRenderTarget();
        renderer.setRenderTarget(this.compositeTarget);
        renderer.render(this.compositeScene, this.compositeCamera);
        renderer.setRenderTarget(prevTarget);
    }
    /** Final composited (scene + rays) texture — blit this instead of PixelPipeline's raw target. */
    getOutputTexture() {
        return this.compositeTarget.texture;
    }
    /**
     * Projects a world-space light position (e.g. SkySystem's directional
     * light position, or a point far along its direction) into the 0..1
     * screen-space coordinate composite() expects.
     */
    static worldToScreen01(worldPos, camera) {
        const ndc = worldPos.clone().project(camera);
        return new THREE.Vector2((ndc.x + 1) / 2, (ndc.y + 1) / 2);
    }
    handleResize(width, height) {
        this.width = width;
        this.height = height;
        this.occlusionTarget.setSize(width, height);
        this.compositeTarget.setSize(width, height);
    }
    dispose() {
        this.occlusionTarget.dispose();
        this.compositeTarget.dispose();
        this.occlusionOverrideMaterial.dispose();
        this.compositeMaterial.dispose();
        this.compositeMesh.geometry.dispose();
        this.sunDiscMaterial.dispose();
        this.sunDiscMesh.geometry.dispose();
    }
}
//# sourceMappingURL=GodRayLayer.js.map