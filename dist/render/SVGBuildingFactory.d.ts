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
import * as THREE from 'three';
import { type Building, type ZoneID } from '../types.js';
import { SVGRasterizer } from './SVGRasterizer.js';
import { TextureCache } from './TextureCache.js';
export interface BuildingDiorama {
    group: THREE.Group;
    width: number;
    depth: number;
    height: number;
}
export declare class SVGBuildingFactory {
    private rasterizer;
    private textureCache;
    private textureWidth;
    private textureHeight;
    constructor(rasterizer?: SVGRasterizer, textureWidth?: number, textureHeight?: number, textureCache?: TextureCache);
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
    build(building: Building, zoneID?: ZoneID): BuildingDiorama;
    private makePlane;
    private generateWallSVG;
    private generateRoofSVG;
}
//# sourceMappingURL=SVGBuildingFactory.d.ts.map