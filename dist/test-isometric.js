/**
 * test-isometric.ts
 * Standalone visual test for milestone M2: "SkySystem + PixelPipeline
 * rendering an empty isometric scene at dusk (23:47)" per the mood
 * board's RS7 — DAY 9, 23:47 reference timestamp.
 *
 * Zero dependency on WorldGenerator/Zone content yet — just a ground
 * plane + a few placeholder boxes to sanity-check the camera angle,
 * pixel-perfect upscale, and sky/fog/lighting integration together.
 *
 * Run with: npx vite
 */
import * as THREE from 'three';
import { IsometricRenderer } from './render/IsometricRenderer.js';
import { SkySystem, WrongnessState } from './render/SkySystem.js';
const canvas = document.createElement('canvas');
canvas.style.width = '100vw';
canvas.style.height = '100vh';
canvas.style.display = 'block';
canvas.style.imageRendering = 'pixelated';
document.body.style.margin = '0';
document.body.style.background = '#000';
document.body.appendChild(canvas);
const isoRenderer = new IsometricRenderer({
    canvas,
    viewSize: 12,
    cameraDistance: 30,
    pixelPipeline: { internalWidth: 384, internalHeight: 216 },
});
const sky = new SkySystem({ textureWidth: 512, textureHeight: 512, zoneSeed: 7007 });
sky.init();
isoRenderer.attachSky(sky);
// ─── M2 placeholder content: ground plane + a handful of silhouette boxes ───
const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1c20 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), groundMat);
ground.rotation.x = -Math.PI / 2;
isoRenderer.scene.add(ground);
const boxMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30 });
const layout = [
    { x: -3, z: -2, h: 2 },
    { x: 1, z: -3, h: 3.5 },
    { x: 3, z: 1, h: 1.5 },
    { x: -2, z: 2.5, h: 2.5 },
    { x: 0, z: 0, h: 1 }, // small reference cube at origin
];
for (const b of layout) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, b.h, 1.5), boxMat);
    box.position.set(b.x, b.h / 2, b.z);
    isoRenderer.scene.add(box);
}
// ─── Dusk default per M2 spec, but keep controls for tuning ───
let timeOfDay = 23 + 47 / 60; // 23:47
let weatherState = 'OVERCAST';
let wrongnessState = WrongnessState.GREY; // RS7, Day 9 — wrongness already accumulating
let fogIntensity = 0.35;
function applySkyState() {
    sky.setFogIntensity(fogIntensity);
    sky.update(0, { timeOfDay, weatherState, wrongnessState, fogIntensity });
    isoRenderer.syncSky();
}
applySkyState();
window.addEventListener('resize', () => isoRenderer.handleResize());
// ─── Minimal debug panel — confirms M2 visually without needing the full sky_preview controls ───
const panel = document.createElement('div');
panel.style.cssText = 'position:fixed;top:8px;left:8px;background:#111;color:#ccc;font:11px monospace;padding:10px;border:1px solid #333;width:220px;';
panel.innerHTML = `
  <div>M2 — RS7 Day 9, 23:47</div>
  <div>Time: <span id="tVal">23.78</span>h</div>
  <input id="tRange" type="range" min="0" max="24" step="0.1" value="23.78" style="width:100%">
  <div style="margin-top:6px;">Wrongness:</div>
  <select id="wrSelect" style="width:100%">
    ${['SUNNY', 'BLUE', 'GREY', 'RAINY', 'STATIC', 'UNKNOWN', 'STORMY', 'DIFFERENT', 'ANOTHER_SKY']
    .map(s => `<option value="${s}" ${s === 'GREY' ? 'selected' : ''}>${s}</option>`).join('')}
  </select>
`;
document.body.appendChild(panel);
const tRange = panel.querySelector('#tRange');
const tVal = panel.querySelector('#tVal');
const wrSelect = panel.querySelector('#wrSelect');
tRange.addEventListener('input', () => {
    timeOfDay = parseFloat(tRange.value);
    tVal.textContent = timeOfDay.toFixed(2);
    applySkyState();
});
wrSelect.addEventListener('input', () => {
    wrongnessState = wrSelect.value;
    applySkyState();
});
let last = performance.now();
function animate(now) {
    requestAnimationFrame(animate);
    const dt = (now - last) / 1000;
    last = now;
    sky.update(dt); // keeps STATIC glitch / star twinkle alive even with no slider input
    isoRenderer.syncSky(dt); // dt drives DustParticles' drift animation
    isoRenderer.render();
}
requestAnimationFrame(animate);
//# sourceMappingURL=test-isometric.js.map