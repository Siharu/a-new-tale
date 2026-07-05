/**
 * test-tilemap.ts
 * Standalone visual test for IsoTileMap — replaces M2's flat placeholder
 * ground plane with a real grid of the curated sliced tiles
 * (assets/tiles/ground_sliced/), to confirm the diamond-grid placement
 * actually interlocks correctly when rendered through the real fixed
 * isometric camera, not just in isolated math.
 *
 * Run with: npx vite
 * (assets/ must be served statically — Vite serves the project root by
 * default, so assets/tiles/ground_sliced/*.png should already resolve.)
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { IsometricRenderer } from './IsometricRenderer.js';
import { SkySystem } from './SkySystem.js';
import { IsoTileMap, loadTileSet } from './IsoTileMap.js';
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
    viewSize: 14,
    cameraDistance: 30,
    pixelPipeline: { internalWidth: 384, internalHeight: 216 },
});
const sky = new SkySystem({ textureWidth: 512, textureHeight: 512, zoneSeed: 4242 });
sky.init();
isoRenderer.attachSky(sky);
sky.update(0, { timeOfDay: 15, weatherState: 'CLEAR', fogIntensity: 0.15 });
isoRenderer.syncSky();
const TILE_NAMES = ['grass_a', 'dirt_a', 'stone_basic', 'stone_rocky_grey', 'forest_a'];
async function main() {
    const tileSet = await loadTileSet('/assets/tiles/ground_sliced', TILE_NAMES);
    // World-unit size of each tile's diamond bounding box. The source PNGs
    // are 256x144 / 256x128 px — pick a world height that keeps the 2:1-ish
    // aspect roughly intact relative to tileWorldWidth, tuned against
    // viewSize so a handful of tiles fill a reasonable chunk of frame.
    const tileWorldWidth = 2.2;
    const tileWorldHeight = 1.2;
    const tileMap = new IsoTileMap({
        camera: isoRenderer.camera,
        tileSet,
        tileWorldWidth,
        tileWorldHeight,
    });
    isoRenderer.scene.add(tileMap.group);
    // 7x7 grid, mostly grass with scattered dirt/stone/forest patches —
    // deterministic pseudo-random pick just for visual variety in this test,
    // not meant to be the real WorldGenerator-driven selection logic.
    const size = 7;
    const grid = [];
    let seed = 99;
    const rng = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return (seed % 1000) / 1000;
    };
    for (let row = 0; row < size; row++) {
        const rowCells = [];
        for (let col = 0; col < size; col++) {
            const r = rng();
            let tileKey = 'grass_a';
            if (r < 0.12)
                tileKey = 'dirt_a';
            else if (r < 0.2)
                tileKey = 'stone_basic';
            else if (r < 0.26)
                tileKey = 'stone_rocky_grey';
            else if (r < 0.32)
                tileKey = 'forest_a';
            rowCells.push({ tileKey });
        }
        grid.push(rowCells);
    }
    tileMap.setGrid(grid);
    // a couple of placeholder boxes still standing on top, to confirm
    // buildings/props will visually sit correctly above the new tile ground
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2, 1.2), boxMat);
    box.position.set(0, 1, 0);
    isoRenderer.scene.add(box);
    window.addEventListener('resize', () => isoRenderer.handleResize());
    function animate() {
        requestAnimationFrame(animate);
        sky.update(0);
        isoRenderer.syncSky();
        isoRenderer.render();
    }
    requestAnimationFrame(animate);
}
main().catch((err) => {
    console.error('test-tilemap failed to start:', err);
});
//# sourceMappingURL=test-tilemap.js.map