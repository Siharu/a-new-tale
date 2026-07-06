/**
 * SVGBuildingFactory
 * Turns a Building (types.ts) into a small "paper diorama" stack of flat
 * planes — front wall, side wall, roof — each with its own procedurally
 * generated SVG facade baked via SVGRasterizer. This is the Octopath
 * Traveler approach: every piece is a flat 2D image on a quad, but
 * arranged in real 3D space so they occlude/shadow correctly from the
 * fixed isometric camera, without ever being true 3D geometry.
 *
 * Everything is generated from the Building's own data (type, size,
 * decayState) plus a seed — no image assets, per the locked
 * SVG-procedural-generation decision. Different BuildingTypes get
 * different window/detail rules so a WAREHOUSE reads differently from
 * a SIGNAL_TOWER without any hand-placed content.
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { BuildingType } from '../types.js';
import { SVGRasterizer } from './SVGRasterizer.js';
// Deterministic seeded RNG (mulberry32) — same approach as SkySystem's
// star/cloud scatter, so identical building data always looks the same.
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const FACADE_RULES = {
    [BuildingType.RESIDENTIAL]: { wallBase: '#5a5650', wallVariant: '#6b6660', windowLit: '#e8c878', windowDark: '#1a1c20', rows: 4, cols: 3, floors: 3, roofColor: '#3a3632', roofStyle: 'peaked' },
    [BuildingType.INDUSTRIAL]: { wallBase: '#4a4d52', wallVariant: '#3a3d42', windowLit: '#9ab0c0', windowDark: '#15171a', rows: 2, cols: 5, floors: 2, roofColor: '#2a2c30', roofStyle: 'flat' },
    [BuildingType.SIGNAL_TOWER]: { wallBase: '#52504e', wallVariant: '#403e3c', windowLit: '#7fffe0', windowDark: '#1a1c1e', rows: 8, cols: 1, floors: 8, roofColor: '#2a2c2e', roofStyle: 'flat' },
    [BuildingType.ARCHIVE]: { wallBase: '#4d4842', wallVariant: '#5e5852', windowLit: '#d8c89a', windowDark: '#181614', rows: 3, cols: 4, floors: 3, roofColor: '#332e2a', roofStyle: 'flat' },
    [BuildingType.MAINTENANCE]: { wallBase: '#46484a', wallVariant: '#383a3c', windowLit: '#b0b8a0', windowDark: '#161718', rows: 1, cols: 2, floors: 1, roofColor: '#242526', roofStyle: 'flat' },
    [BuildingType.RADIO_STATION]: { wallBase: '#504a52', wallVariant: '#403c44', windowLit: '#ff9a5c', windowDark: '#1a161c', rows: 2, cols: 3, floors: 2, roofColor: '#2e2832', roofStyle: 'peaked' },
    [BuildingType.POWER_PLANT]: { wallBase: '#48484a', wallVariant: '#56564f', windowLit: '#e8a83c', windowDark: '#17171a', rows: 3, cols: 6, floors: 3, roofColor: '#2c2c2e', roofStyle: 'flat' },
    [BuildingType.WAREHOUSE]: { wallBase: '#525048', wallVariant: '#5e5c52', windowLit: '#c8c0a0', windowDark: '#1a1916', rows: 1, cols: 4, floors: 1, roofColor: '#34322c', roofStyle: 'flat' },
};
const FLOOR_HEIGHT = 1.4; // world units per floor, used to derive building height from `floors`
export class SVGBuildingFactory {
    constructor(rasterizer, textureWidth = 256, textureHeight = 256, textureCache) {
        this.rasterizer = rasterizer ?? new SVGRasterizer();
        this.textureCache = textureCache ?? null;
        this.textureWidth = textureWidth;
        this.textureHeight = textureHeight;
    }
    /**
     * Generates the diorama group for a Building and assigns it to
     * building.svgMesh (typed `unknown` in types.ts specifically to avoid
     * a Three.js dependency in the schema — this is the one place that
     * cast happens).
     *
     * @param building  Building data from WorldGenerator.
     * @param zoneID    The zone this building belongs to. Required for TextureCache
     *                  zone-eviction — all baked textures are registered under this
     *                  zoneID so ZoneStreamer.evictZone() clears them on unload.
     */
    build(building, zoneID) {
        const rules = FACADE_RULES[building.type];
        // Use the deterministic per-building seed assigned by WorldGenerator
        // (drawn from the zone's RNG stream), NOT building.id — id is
        // generated via Date.now()+Math.random() purely for uniqueness as a
        // Map key, and is NOT reproducible across runs with the same world
        // seed. Seeding facade generation from it would silently break the
        // "same seed -> same world" guarantee the whole pipeline depends on.
        const seed = building.seed;
        const rng = mulberry32(seed);
        const width = Math.max(2, building.size.width);
        const depth = Math.max(2, building.size.height); // Size2.height = footprint depth, not building height
        const floors = Math.max(1, rules.floors + Math.floor(rng() * 2) - 1); // +/-1 floor variance per building
        const height = floors * FLOOR_HEIGHT;
        const decay = THREE.MathUtils.clamp(building.decayState, 0, 1);
        const group = new THREE.Group();
        group.name = `building:${building.id}`;
        const cacheBase = `bldg:${building.type}:${seed}:${decay.toFixed(2)}:${width.toFixed(1)}x${height.toFixed(1)}`;
        // Wrapper: register with TextureCache (if wired) and touch after every bake.
        const bake = (svg, suffix) => {
            const cacheKey = `${cacheBase}:${suffix}`;
            if (this.textureCache && zoneID) {
                this.textureCache.registerKey(cacheKey, zoneID);
            }
            const tex = this.rasterizer.bakeImmediate(svg, {
                width: this.textureWidth,
                height: this.textureHeight,
                cacheKey,
            });
            if (this.textureCache) {
                this.textureCache.touch(cacheKey);
            }
            return tex;
        };
        // front wall
        const frontSvg = this.generateWallSVG(rules, width, height, decay, rng, 'front');
        const frontTex = bake(frontSvg, 'front');
        const frontPlane = this.makePlane(width, height, frontTex);
        frontPlane.position.set(0, height / 2, depth / 2);
        group.add(frontPlane);
        // side wall — only generated if footprint is non-square enough to matter
        // from the fixed isometric angle, otherwise it's wasted draw calls/bake time
        if (Math.abs(width - depth) > 0.5 || depth > width) {
            const sideSvg = this.generateWallSVG(rules, depth, height, decay, rng, 'side');
            const sideTex = bake(sideSvg, 'side');
            const sidePlane = this.makePlane(depth, height, sideTex);
            sidePlane.rotation.y = -Math.PI / 2;
            sidePlane.position.set(width / 2, height / 2, 0);
            group.add(sidePlane);
        }
        // roof
        const roofSvg = this.generateRoofSVG(rules, width, depth, decay);
        const roofTex = bake(roofSvg, 'roof');
        const roofPlane = this.makePlane(width, depth, roofTex);
        roofPlane.rotation.x = -Math.PI / 2;
        roofPlane.position.set(0, height, 0);
        group.add(roofPlane);
        building.svgMesh = group;
        return { group, width, depth, height };
    }
    makePlane(w, h, texture) {
        const geometry = new THREE.PlaneGeometry(w, h);
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            transparent: false,
            side: THREE.FrontSide,
        });
        return new THREE.Mesh(geometry, material);
    }
    // ─── SVG generation (pure markup, no canvas calls here — SVGRasterizer owns drawing) ───
    generateWallSVG(rules, _width, _height, decay, rng, _face) {
        const W = this.textureWidth;
        const H = this.textureHeight;
        const parts = [];
        parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">`);
        parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${rules.wallBase}"/>`);
        // vertical trim panels — cheap variation without needing real geometry
        const panelCount = 3 + Math.floor(rng() * 3);
        for (let i = 0; i < panelCount; i++) {
            const px = (i / panelCount) * W;
            const pw = (W / panelCount) * (0.85 + rng() * 0.1);
            parts.push(`<rect x="${px.toFixed(1)}" y="0" width="${pw.toFixed(1)}" height="${H}" fill="${rules.wallVariant}" opacity="${(0.08 + rng() * 0.1).toFixed(2)}"/>`);
        }
        // window grid — driven by rules.rows/cols, individual windows go dark
        // with probability scaled by decay (broken/abandoned look)
        const marginX = W * 0.08;
        const marginY = H * 0.08;
        const gridW = W - marginX * 2;
        const gridH = H - marginY * 2;
        const cellW = gridW / rules.cols;
        const cellH = gridH / rules.rows;
        const winW = cellW * 0.55;
        const winH = cellH * 0.6;
        for (let row = 0; row < rules.rows; row++) {
            for (let col = 0; col < rules.cols; col++) {
                const cx = marginX + col * cellW + (cellW - winW) / 2;
                const cy = marginY + row * cellH + (cellH - winH) / 2;
                const broken = rng() < decay * 0.6;
                const lit = !broken && rng() < 0.35 * (1 - decay);
                const color = broken ? rules.windowDark : lit ? rules.windowLit : rules.wallVariant;
                const winOpacity = broken ? 0.9 : lit ? 0.95 : 0.6;
                parts.push(`<rect x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" width="${winW.toFixed(1)}" height="${winH.toFixed(1)}" fill="${color}" opacity="${winOpacity}"/>`);
                if (broken) {
                    // a crude crack — two crossing lines — cheap "broken glass" tell
                    parts.push(`<line x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${(cx + winW).toFixed(1)}" y2="${(cy + winH).toFixed(1)}" stroke="#000" stroke-width="1" opacity="0.4"/>`);
                }
            }
        }
        // decay streaks — vertical stains running down from the roofline,
        // intensity/count scaled by decay
        if (decay > 0.15) {
            const streakCount = Math.floor(decay * 8);
            for (let i = 0; i < streakCount; i++) {
                const sx = rng() * W;
                const sLen = H * (0.3 + rng() * 0.5 * decay);
                parts.push(`<rect x="${sx.toFixed(1)}" y="0" width="${(2 + rng() * 3).toFixed(1)}" height="${sLen.toFixed(1)}" fill="#000" opacity="${(0.1 + decay * 0.2).toFixed(2)}"/>`);
            }
        }
        parts.push('</svg>');
        return parts.join('');
    }
    generateRoofSVG(rules, width, depth, decay) {
        const W = this.textureWidth;
        const H = this.textureHeight;
        const parts = [];
        parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">`);
        parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${rules.roofColor}"/>`);
        if (rules.roofStyle === 'peaked') {
            // simple ridge line + shading split down the middle
            parts.push(`<rect x="0" y="0" width="${W / 2}" height="${H}" fill="#000" opacity="0.12"/>`);
            parts.push(`<line x1="${W / 2}" y1="0" x2="${W / 2}" y2="${H}" stroke="#000" stroke-width="2" opacity="0.3"/>`);
        }
        // grime patches scaled by decay
        if (decay > 0.1) {
            const rng = mulberry32(Math.floor((width + depth) * 1000) + Math.floor(decay * 1000));
            const patchCount = Math.floor(decay * 6);
            for (let i = 0; i < patchCount; i++) {
                const px = rng() * W;
                const py = rng() * H;
                const r = 8 + rng() * 20;
                parts.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r.toFixed(1)}" fill="#000" opacity="${(0.08 + decay * 0.15).toFixed(2)}"/>`);
            }
        }
        parts.push('</svg>');
        return parts.join('');
    }
}
//# sourceMappingURL=SVGBuildingFactory.js.map