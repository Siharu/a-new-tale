/**
 * LightingController
 * Step 2.4 in the rendering build order (SkySystem -> IsometricRenderer/
 * PixelPipeline -> LightingController -> GodRayLayer -> ...).
 *
 * SkySystem already produces a correctly-colored/positioned directional
 * light (sun or moon) per bake, and IsometricRenderer.syncSky() copies its
 * color/intensity/position onto the scene's light each frame. What's
 * missing — and what this class owns — is everything that makes that light
 * actually feel like the references (13 Sentinels, Octopath): shadow
 * casting, and the relationship between sun ANGLE and shadow LENGTH/
 * SOFTNESS that those games lean on so heavily at dawn/dusk.
 *
 * Deliberately separate from SkySystem (color/position only, no renderer
 * concerns) and from IsometricRenderer (owns the scene/camera, not shadow
 * tuning) — same separation-of-concerns the file structure already uses
 * for PixelPipeline vs IsometricRenderer.
 *
 * Usage:
 *   const lighting = new LightingController(isoRenderer.renderer);
 *   lighting.attach(isoRenderer.scene, isoRenderer.directionalLight, isoRenderer.camera);
 *   // each frame, AFTER isoRenderer.syncSky():
 *   lighting.update(sky.lastSunY01, sky.isNight);  // or however angle is sourced
 *
 * Shadow casters: call lighting.registerCaster(mesh) / registerReceiver(mesh)
 * as building/ground geometry comes online in later milestones. Nothing
 * here assumes specific game content — it's content-agnostic by design,
 * same as IsometricRenderer's M2 scope.
 */
import * as THREE from 'three';
export class LightingController {
    constructor(renderer, options = {}) {
        this.scene = null;
        this.keyLight = null;
        this.sceneCamera = null;
        this.casters = new Set();
        this.sceneRadius = 12; // fallback shadow-frustum half-extent until fitToScene() runs
        this.renderer = renderer;
        this.shadowMapSize = options.shadowMapSize ?? 1024;
        this.fillColor = options.fillLightColor ?? 0x4a5a8a;
        this.fillIntensity = options.fillLightIntensity ?? 0.18;
        this.minSoft = options.minShadowSoftness ?? 1;
        this.maxSoft = options.maxShadowSoftness ?? 4;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.fillLight = new THREE.DirectionalLight(this.fillColor, this.fillIntensity);
        this.fillLight.castShadow = false; // fill light never casts — key light only,
        // avoids double-shadow artifacts
    }
    /**
     * Wires shadow casting onto IsometricRenderer's existing directional
     * light, and adds the cool fill light to the same scene. Call once,
     * after IsometricRenderer.attachSky() has created the key light.
     */
    attach(scene, keyLight, sceneCamera) {
        this.scene = scene;
        this.keyLight = keyLight;
        this.sceneCamera = sceneCamera; // retained for getSceneCamera() — GodRayLayer's
        // worldToScreen01() needs this same camera
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(this.shadowMapSize, this.shadowMapSize);
        keyLight.shadow.bias = -0.0015; // tuned to avoid peter-panning/acne at this map size
        keyLight.shadow.normalBias = 0.02;
        this.fitShadowFrustum(this.sceneRadius);
        scene.add(this.fillLight);
    }
    /**
     * Sizes the shadow camera's ortho frustum to the play area. Call again
     * whenever zone bounds change size (e.g. on ZoneStreamer load) — too
     * tight clips shadows at the edges, too loose wastes shadow-map resolution.
     */
    fitToScene(radius) {
        this.sceneRadius = radius;
        this.fitShadowFrustum(radius);
    }
    fitShadowFrustum(radius) {
        if (!this.keyLight)
            return;
        const cam = this.keyLight.shadow.camera;
        cam.left = -radius;
        cam.right = radius;
        cam.top = radius;
        cam.bottom = -radius;
        cam.near = 0.5;
        cam.far = radius * 6;
        cam.updateProjectionMatrix();
    }
    /** Mark a mesh as something that should cast/receive shadows. Idempotent. */
    registerCaster(mesh, receivesToo = true) {
        mesh.castShadow = true;
        mesh.receiveShadow = receivesToo;
        this.casters.add(mesh);
    }
    registerReceiverOnly(mesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = true;
    }
    unregister(mesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        this.casters.delete(mesh);
    }
    /**
     * Call once per frame, AFTER IsometricRenderer.syncSky() has pushed the
     * latest sun/moon color+position onto the key light. Reshapes shadow
     * softness and positions the fill light opposite the key light based on
     * how low the light angle currently is.
     *
     * @param sunElevation01  0 = light at the horizon (dawn/dusk), 1 = light
     *                        directly overhead (noon). Derive from SkySystem's
     *                        sunY (1 - sunY, roughly) or pass through directly
     *                        if SkySystem exposes elevation later.
     * @param isNight         dims the fill light further at night so it
     *                        doesn't fight the moon's already-low intensity.
     */
    update(sunElevation01, isNight) {
        if (!this.keyLight)
            return;
        const elevation = THREE.MathUtils.clamp(sunElevation01, 0, 1);
        // Low elevation (dusk/dawn) -> longer, softer shadows. This is the
        // single biggest contributor to the 13 Sentinels/Octopath look at
        // golden hour — shadows stretch and lose their hard edge.
        const softness = THREE.MathUtils.lerp(this.maxSoft, this.minSoft, elevation);
        this.keyLight.shadow.radius = softness;
        // PCFSoftShadowMap ignores .radius natively in some three.js versions;
        // blurSamples is the modern equivalent and safe to set alongside it.
        this.keyLight.shadow.blurSamples = 8;
        // Fill light sits opposite the key light, scaled down further at night
        // (moonlight is already dim — don't wash out the moodiness with a fill).
        const dir = this.keyLight.position.clone().normalize();
        this.fillLight.position.copy(dir.multiplyScalar(-this.sceneRadius));
        this.fillLight.intensity = isNight ? this.fillIntensity * 0.4 : this.fillIntensity;
    }
    /** Returns the camera passed to attach() — handy for GodRayLayer's worldToScreen01() reusing the same camera. */
    getSceneCamera() {
        return this.sceneCamera;
    }
    dispose() {
        if (this.scene)
            this.scene.remove(this.fillLight);
        this.casters.clear();
    }
}
//# sourceMappingURL=LightingController.js.map