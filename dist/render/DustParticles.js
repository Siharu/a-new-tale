/**
 * DustParticles
 * Step 2.6 in the rendering build order (... -> GodRayLayer -> DustParticles
 * -> AtmosphereController -> ...).
 *
 * The "light rays in the dust" look from the references (image 2's beam,
 * image 4's window shafts) isn't really about GodRayLayer alone — what
 * sells it is dust motes catching that light. This is a single GPU point-
 * sprite system, additively blended, where each particle's brightness is
 * driven by how "backlit" it is relative to the current key light: motes
 * sitting between the camera and the light glow noticeably brighter than
 * ones lit from the front, which is the real-world Mie-scattering cue our
 * eyes read as "floating in a sunbeam." Cheap approximation (a dot product
 * in the fragment shader), not real volumetrics — fits the hand-rolled-
 * shader convention already set by GodRayLayer rather than pulling in a
 * particle library.
 *
 * All seeded via the existing SeededRandom (utils.ts) so a zone's dust
 * field is stable/reproducible per zone.seed, same convention SkySystem
 * already uses for its stars/clouds (there via its own mulberry32 — kept
 * separate there since SkySystem predates this file and re-baking its
 * RNG would risk shifting already-tuned star/cloud positions; new systems
 * from here on should use SeededRandom for consistency).
 *
 * Usage:
 *   const dust = new DustParticles({ count: 200, bounds: viewSize * 1.5, zoneSeed: zone.seed });
 *   dust.addToScene(isoRenderer.scene);
 *   // each frame, after syncSky():
 *   dust.update(deltaTime, isoRenderer.directionalLightWorldPos, sky.fogColor /* or sunMoon tint *\/, fogIntensity);
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { SeededRandom } from '../utils.js';
const DUST_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec3 uLightWorldPos;
  uniform float uWrapHeight; // matches DustParticlesOptions.bounds * 0.8 spawn height — keep these in sync

  attribute float aSeed;
  attribute float aSize;
  attribute float aSpeed;
  attribute vec3 aBasePos;

  varying float vBrightness;
  varying float vSeed;

  void main() {
    // gentle drift: slow downward fall + per-particle sine wander on X/Z,
    // phase-offset by aSeed so particles don't move in visible unison
    vec3 pos = aBasePos;
    pos.y -= mod(uTime * aSpeed, uWrapHeight);
    pos.x += sin(uTime * 0.6 + aSeed * 31.7) * 0.15;
    pos.z += cos(uTime * 0.5 + aSeed * 17.3) * 0.15;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // backlit brightness cue: how aligned is (particle -> camera) with
    // (particle -> light)? Particles sitting roughly between camera and
    // light score highest — this is the "floating in the sunbeam" tell.
    vec3 toLight = normalize(uLightWorldPos - pos);
    vec3 toCamera = normalize(cameraPosition - pos);
    vBrightness = pow(max(dot(toLight, toCamera), 0.0), 4.0);
    vSeed = aSeed;

    gl_Position = projectionMatrix * mvPosition;
    // size attenuates with distance, like THREE's built-in sizeAttenuation
    gl_PointSize = aSize * uPixelRatio * (300.0 / -mvPosition.z);
  }
`;
const DUST_FRAGMENT = /* glsl */ `
  uniform vec3 uBaseColor;
  uniform vec3 uRayColor;
  uniform float uOpacity;

  varying float vBrightness;
  varying float vSeed;

  void main() {
    // soft circular sprite — discard outside radius, fade toward edge
    vec2 fromCenter = gl_PointCoord - vec2(0.5);
    float dist = length(fromCenter);
    if (dist > 0.5) discard;
    float edgeFade = 1.0 - smoothstep(0.2, 0.5, dist);

    // base motes are faint/neutral; backlit ones shift toward the light's
    // own color and brighten substantially — same tint GodRayLayer uses,
    // passed in each frame, so dust and rays read as one coherent effect
    vec3 color = mix(uBaseColor, uRayColor, vBrightness);
    float alpha = edgeFade * uOpacity * (0.15 + vBrightness * 0.85);

    gl_FragColor = vec4(color, alpha);
  }
`;
export class DustParticles {
    constructor(options = {}) {
        this.elapsed = 0;
        this.addedToScene = null;
        this.count = options.count ?? 150;
        this.bounds = options.bounds ?? 8;
        this.geometry = new THREE.BufferGeometry();
        this.material = new THREE.ShaderMaterial({
            vertexShader: DUST_VERTEX,
            fragmentShader: DUST_FRAGMENT,
            uniforms: {
                uTime: { value: 0 },
                uPixelRatio: { value: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1 },
                uLightWorldPos: { value: new THREE.Vector3(0, 10, 0) },
                uWrapHeight: { value: this.bounds * 0.8 },
                uBaseColor: { value: (options.baseColor ?? new THREE.Color(0xd8cdb8)).clone() },
                uRayColor: { value: new THREE.Color(0xfff3d6) },
                uOpacity: { value: 0.5 },
            },
            transparent: true,
            depthWrite: false,
            depthTest: true,
            blending: THREE.AdditiveBlending,
        });
        this.populate(options.zoneSeed ?? Math.floor(Math.random() * 1e9), options.minSize ?? 1.5, options.maxSize ?? 4, options.minSpeed ?? 0.15, options.maxSpeed ?? 0.5);
        this.points = new THREE.Points(this.geometry, this.material);
        this.points.frustumCulled = false; // particles drift/wrap outside their original bounding sphere; cheap at this count
    }
    populate(seed, minSize, maxSize, minSpeed, maxSpeed) {
        const rng = new SeededRandom(seed);
        const basePos = new Float32Array(this.count * 3);
        const sizes = new Float32Array(this.count);
        const speeds = new Float32Array(this.count);
        const seeds = new Float32Array(this.count);
        for (let i = 0; i < this.count; i++) {
            basePos[i * 3 + 0] = rng.nextFloat(-this.bounds, this.bounds);
            basePos[i * 3 + 1] = rng.nextFloat(0, this.bounds * 0.8); // bias toward lower/mid air, not the sky dome
            basePos[i * 3 + 2] = rng.nextFloat(-this.bounds, this.bounds);
            sizes[i] = rng.nextFloat(minSize, maxSize);
            speeds[i] = rng.nextFloat(minSpeed, maxSpeed);
            seeds[i] = rng.next() * 1000;
        }
        this.geometry.setAttribute('aBasePos', new THREE.BufferAttribute(basePos, 3));
        this.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        this.geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
        this.geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
        // dummy 'position' attribute — required by THREE.Points/BufferGeometry
        // conventions even though the vertex shader rebuilds position from
        // aBasePos itself; keeps this compatible with anything that expects
        // a standard position attribute to exist (e.g. bounding sphere calc).
        this.geometry.setAttribute('position', new THREE.BufferAttribute(basePos.slice(), 3));
    }
    /** Re-seed the whole field — call on zone change so each region gets a stable-but-distinct dust layout. */
    reseed(zoneSeed, minSize = 1.5, maxSize = 4, minSpeed = 0.15, maxSpeed = 0.5) {
        this.populate(zoneSeed, minSize, maxSize, minSpeed, maxSpeed);
    }
    /** Exposes the underlying THREE.Points object — needed so callers (e.g. IsometricRenderer) can tag it via GodRayLayer.hideDuringOcclusion() before adding it to the scene. */
    getObject3D() {
        return this.points;
    }
    addToScene(scene) {
        if (this.addedToScene === scene)
            return;
        scene.add(this.points);
        this.addedToScene = scene;
    }
    removeFromScene() {
        if (this.addedToScene) {
            this.addedToScene.remove(this.points);
            this.addedToScene = null;
        }
    }
    /**
     * Call once per frame, ideally right after IsometricRenderer.syncSky()
     * so lightWorldPos/rayColor reflect the current bake.
     *
     * @param deltaTime    seconds since last frame
     * @param lightWorldPos  the key light's world position (e.g.
     *                       isoRenderer's directional light .position) —
     *                       drives the backlit-brightness cue
     * @param rayColor     tint to shift backlit motes toward; pass the same
     *                     color GodRayLayer.setRayColor() received so dust
     *                     and rays read as one coherent light source
     * @param fogOrHazeIntensity  0–1, scales overall dust opacity — heavier
     *                            fog/haze makes suspended dust read as MORE
     *                            visible (it's catching ambient scatter), not
     *                            less, so this is a direct (not inverse) mix
     */
    update(deltaTime, lightWorldPos, rayColor, fogOrHazeIntensity = 0.3) {
        this.elapsed += deltaTime;
        this.material.uniforms.uTime.value = this.elapsed;
        this.material.uniforms.uLightWorldPos.value.copy(lightWorldPos);
        this.material.uniforms.uRayColor.value.copy(rayColor);
        this.material.uniforms.uOpacity.value = THREE.MathUtils.lerp(0.25, 0.65, THREE.MathUtils.clamp(fogOrHazeIntensity, 0, 1));
    }
    /** Direct opacity override if a caller wants to fade dust out entirely (e.g. indoors, or during Obsedia Rain where streaks replace it). */
    setOpacity(value) {
        this.material.uniforms.uOpacity.value = value;
    }
    dispose() {
        this.removeFromScene();
        this.geometry.dispose();
        this.material.dispose();
    }
}
//# sourceMappingURL=DustParticles.js.map