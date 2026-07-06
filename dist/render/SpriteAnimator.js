import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
/** Eight directional vectors for sprite orientation (in world coordinates). */
export const DIRECTIONS = {
    NORTH: { x: 0, y: -1, name: 'north' },
    NORTHEAST: { x: 1, y: -1, name: 'northeast' },
    EAST: { x: 1, y: 0, name: 'east' },
    SOUTHEAST: { x: 1, y: 1, name: 'southeast' },
    SOUTH: { x: 0, y: 1, name: 'south' },
    SOUTHWEST: { x: -1, y: 1, name: 'southwest' },
    WEST: { x: -1, y: 0, name: 'west' },
    NORTHWEST: { x: -1, y: -1, name: 'northwest' },
    IDLE: { x: 0, y: 0, name: 'idle' },
};
/**
 * Maps a 2D input vector to the closest cardinal/diagonal direction.
 * Returns IDLE if magnitude is negligible.
 */
export function vectorToDirection(x, y) {
    const mag = Math.sqrt(x * x + y * y);
    if (mag < 0.1)
        return DIRECTIONS.IDLE;
    const angle = Math.atan2(y, x);
    const degrees = (angle * 180) / Math.PI;
    const normalized = ((degrees + 360) % 360);
    // 8-way: each direction gets 45°
    if (normalized < 22.5)
        return DIRECTIONS.EAST;
    if (normalized < 67.5)
        return DIRECTIONS.SOUTHEAST;
    if (normalized < 112.5)
        return DIRECTIONS.SOUTH;
    if (normalized < 157.5)
        return DIRECTIONS.SOUTHWEST;
    if (normalized < 202.5)
        return DIRECTIONS.WEST;
    if (normalized < 247.5)
        return DIRECTIONS.NORTHWEST;
    if (normalized < 292.5)
        return DIRECTIONS.NORTH;
    if (normalized < 337.5)
        return DIRECTIONS.NORTHEAST;
    return DIRECTIONS.EAST;
}
/**
 * Loads an image as a canvas-backed THREE.CanvasTexture (for browser compatibility),
 * then creates a sprite mesh with animation driven by input direction.
 *
 * Two modes:
 * - Spritesheet mode (initialize): frames laid out in a grid, 8 direction rows.
 * - Directional-stills mode (initializeDirectional): one PNG per direction,
 *   matching the real asset sets on disk. Facing swaps instantly; idle keeps
 *   the last facing. Walk-cycle spritesheets can replace this later without
 *   touching callers.
 *
 * Geometry: Always creates a Plane (billboard).
 * Lighting: Material is unlit so the character is always readable.
 */
export class SpriteAnimator {
    constructor(config) {
        this.texture = null;
        this.mesh = null;
        this.canvas = null;
        this.animationTime = 0;
        this.currentDirection = DIRECTIONS.IDLE;
        this.frameIndex = 0;
        this.canvas2d = null;
        this.sourceImage = null;
        /** Width/height of a single frame in pixels (set after image loads). */
        this.frameWidth = 64;
        this.frameHeight = 64;
        /** Directional-stills mode state. */
        this.directionalImages = null;
        this.lastFacingFile = 'south';
        this.config = config;
    }
    /**
     * Load image from URL and initialize the sprite mesh (spritesheet mode).
     * Returns the Three.js Mesh ready to add to scene.
     */
    async initialize(imagePath, width = 2, height = 2.5) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                this.sourceImage = img;
                // Calculate frame dimensions from image and config.
                const cols = this.config.framesPerDirection;
                const rows = 8; // 8 directions
                this.frameWidth = img.naturalWidth / cols;
                this.frameHeight = img.naturalHeight / rows;
                // Create canvas for rendering individual frames.
                this.canvas = document.createElement('canvas');
                this.canvas.width = this.frameWidth;
                this.canvas.height = this.frameHeight;
                this.canvas2d = this.canvas.getContext('2d', { alpha: true });
                this.texture = new THREE.CanvasTexture(this.canvas);
                this.texture.magFilter = THREE.NearestFilter;
                this.texture.minFilter = THREE.NearestFilter;
                // Draw initial frame
                this.drawFrame(0, DIRECTIONS.IDLE);
                // Create mesh
                const geometry = new THREE.PlaneGeometry(width, height);
                const material = new THREE.MeshBasicMaterial({
                    map: this.texture,
                    transparent: true,
                    side: THREE.DoubleSide,
                    fog: false,
                });
                this.mesh = new THREE.Mesh(geometry, material);
                this.mesh.position.y += height / 2; // Raise so feet are at origin
                resolve(this.mesh);
            };
            img.onerror = () => {
                reject(new Error(`Failed to load sprite: ${imagePath}`));
            };
            img.src = imagePath;
        });
    }
    /**
     * Load one still PNG per direction from `basePath` (north.png, north-east.png,
     * east.png, south-east.png, south.png, south-west.png, west.png, north-west.png)
     * and initialize the sprite mesh (directional-stills mode). Missing directions
     * fall back to south / whatever loaded. Throws only if nothing loads.
     */
    async initializeDirectional(basePath, width = 2, height = 2.5) {
        const files = Object.values(SpriteAnimator.DIRECTION_FILES);
        const loaded = await Promise.all(files.map((file) => new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve([file, img]);
            img.onerror = () => resolve([file, null]);
            img.src = `${basePath}/${file}.png`;
        })));
        const images = new Map();
        for (const [file, img] of loaded) {
            if (img)
                images.set(file, img);
        }
        const reference = images.get('south') ?? images.values().next().value;
        if (!reference) {
            throw new Error(`No directional sprites found at ${basePath}`);
        }
        this.directionalImages = images;
        this.frameWidth = reference.naturalWidth;
        this.frameHeight = reference.naturalHeight;
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.frameWidth;
        this.canvas.height = this.frameHeight;
        this.canvas2d = this.canvas.getContext('2d', { alpha: true });
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.magFilter = THREE.NearestFilter;
        this.texture.minFilter = THREE.NearestFilter;
        this.drawDirectionalFrame(DIRECTIONS.SOUTH);
        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshBasicMaterial({
            map: this.texture,
            transparent: true,
            side: THREE.DoubleSide,
            fog: false,
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.y += height / 2;
        return this.mesh;
    }
    /**
     * Update animation based on direction and elapsed time.
     * Should be called once per frame (tick).
     */
    update(deltaSeconds, inputDirection) {
        this.currentDirection = inputDirection;
        this.animationTime += deltaSeconds;
        if (this.directionalImages) {
            // Directional-stills mode — swap the still for the current facing.
            this.drawDirectionalFrame(this.currentDirection);
            if (this.texture) {
                this.texture.needsUpdate = true;
            }
            return;
        }
        const frameTime = 1 / this.config.animationFps;
        this.frameIndex = Math.floor(this.animationTime / frameTime) % this.config.framesPerDirection;
        this.drawFrame(this.frameIndex, this.currentDirection);
        if (this.texture) {
            this.texture.needsUpdate = true;
        }
    }
    /** Draw the still for a facing; idle keeps the last non-idle facing. */
    drawDirectionalFrame(direction) {
        if (!this.canvas2d || !this.directionalImages)
            return;
        let file = SpriteAnimator.DIRECTION_FILES[direction.name] ?? this.lastFacingFile;
        if (direction.name === 'idle') {
            file = this.lastFacingFile;
        }
        else {
            this.lastFacingFile = file;
        }
        const img = this.directionalImages.get(file) ??
            this.directionalImages.get('south') ??
            this.directionalImages.values().next().value;
        if (!img)
            return;
        this.canvas2d.clearRect(0, 0, this.frameWidth, this.frameHeight);
        this.canvas2d.drawImage(img, 0, 0, this.frameWidth, this.frameHeight);
    }
    /**
     * Draw a specific frame to the canvas texture (spritesheet mode).
     * Frame indexing: `directionIndex * framesPerDirection + frameIndex`.
     */
    drawFrame(frameIndex, direction) {
        if (!this.canvas2d || !this.sourceImage)
            return;
        // Direction index (NORTH=0, NORTHEAST=1, ..., NORTHWEST=7)
        const directionIndex = this.getDirectionIndex(direction);
        // Source rectangle in the sprite sheet
        const srcX = frameIndex * this.frameWidth;
        const srcY = directionIndex * this.frameHeight;
        // Clear and draw
        this.canvas2d.clearRect(0, 0, this.frameWidth, this.frameHeight);
        this.canvas2d.drawImage(this.sourceImage, srcX, srcY, this.frameWidth, this.frameHeight, 0, 0, this.frameWidth, this.frameHeight);
    }
    getDirectionIndex(direction) {
        const map = {
            north: 0,
            northeast: 1,
            east: 2,
            southeast: 3,
            south: 4,
            southwest: 5,
            west: 6,
            northwest: 7,
            idle: 0, // Default to north for idle
        };
        return map[direction.name] ?? 0;
    }
    getMesh() {
        return this.mesh;
    }
    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
        if (this.texture) {
            this.texture.dispose();
        }
    }
}
SpriteAnimator.DIRECTION_FILES = {
    north: 'north',
    northeast: 'north-east',
    east: 'east',
    southeast: 'south-east',
    south: 'south',
    southwest: 'south-west',
    west: 'west',
    northwest: 'north-west',
};
//# sourceMappingURL=SpriteAnimator.js.map