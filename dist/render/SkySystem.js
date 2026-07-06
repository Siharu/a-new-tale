/**
 * SkySystem
 * Procedural sky: hand-authored color keyframes (not generated hue cycle),
 * baked from SVG-style canvas drawing -> THREE.CanvasTexture, per the locked
 * SVG-procedural-generation approach.
 *
 * Drives ambient/fog color from a single source of truth (the sky), per
 * the locked architecture decision in DRIFTER_ENGINE_PLAN.md.
 *
 * v2 — reworked around the Cygnus Signal Series lore:
 *   - WrongnessState replaces the old continuous corruptionOverlay slider.
 *     Discrete, hand-authored progression: SUNNY -> BLUE -> GREY -> RAINY ->
 *     STATIC -> UNKNOWN -> STORMY -> DIFFERENT -> ANOTHER_SKY.
 *     STATIC gets an actual glitch/flicker pass, not just a color shift.
 *   - Moon is now a tracked, persistent object (position/phase/anomaly),
 *     independent of the day/night sunMoon glow — it can be visible (faint)
 *     during the day and is a plot anchor (Moon Dome), not just a light.
 *   - Obsedia Rain (black oil rain / Black Rain / Moon Rain / Starfall) is
 *     a distinct overlay effect: random, unpredictable, bleeds the sky dark
 *     and gooey rather than being tied to a WeatherType.
 *   - Stars + procedural clouds folded in as additional baked layers,
 *     seeded per zone so each Drifter's region reads as visually distinct.
 *
 * Tune colors first in sky_preview.html (update it alongside this file —
 * the math should stay identical on both sides), then port changes here.
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { WrongnessState } from '../types.js';
// WrongnessState now lives in types.ts (single source of truth — types.ts is
// pure schema, SkySystem.ts is implementation; see patch-types.sh). Re-exported
// here so existing `import { WrongnessState } from './render/SkySystem.js'`
// call sites (e.g. test-sky.ts) keep working without churn.
export { WrongnessState };
// Sits ALONGSIDE WeatherType (environmental) rather than replacing it.
// A zone is described by BOTH: e.g. Finland start = RAINY + OVERCAST,
// Nepal = STORMY + DUST_EVENT, etc.
// Ordered for interpolation / progress math (e.g. UI debug readouts, lerping
// between two states during a transition scene). Index = severity rank.
export const WRONGNESS_ORDER = [
    WrongnessState.SUNNY,
    WrongnessState.BLUE,
    WrongnessState.GREY,
    WrongnessState.RAINY,
    WrongnessState.STATIC,
    WrongnessState.UNKNOWN,
    WrongnessState.STORMY,
    WrongnessState.DIFFERENT,
    WrongnessState.ANOTHER_SKY,
];
const WRONGNESS_PALETTE = {
    SUNNY: { tint: [1, 1, 1], desat: 0, hazeBoost: 0, shiftHex: null, shiftAmount: 0, glitch: false },
    BLUE: { tint: [0.95, 0.97, 1.05], desat: 0.05, hazeBoost: 0.05, shiftHex: '#3c5a8a', shiftAmount: 0.08, glitch: false },
    GREY: { tint: [0.88, 0.88, 0.9], desat: 0.35, hazeBoost: 0.15, shiftHex: '#7d7d82', shiftAmount: 0.2, glitch: false },
    RAINY: { tint: [0.78, 0.82, 0.86], desat: 0.4, hazeBoost: 0.3, shiftHex: '#5c6670', shiftAmount: 0.25, glitch: false },
    STATIC: { tint: [0.7, 0.72, 0.78], desat: 0.3, hazeBoost: 0.2, shiftHex: '#8a8fae', shiftAmount: 0.3, glitch: true },
    UNKNOWN: { tint: [0.65, 0.6, 0.7], desat: 0.2, hazeBoost: 0.25, shiftHex: '#6e4f8a', shiftAmount: 0.35, glitch: false },
    STORMY: { tint: [0.55, 0.52, 0.6], desat: 0.15, hazeBoost: 0.4, shiftHex: '#4a3a5c', shiftAmount: 0.4, glitch: false },
    DIFFERENT: { tint: [0.7, 0.45, 0.55], desat: 0.1, hazeBoost: 0.3, shiftHex: '#8a3a5a', shiftAmount: 0.5, glitch: false },
    ANOTHER_SKY: { tint: [0.85, 0.3, 0.4], desat: 0.05, hazeBoost: 0.35, shiftHex: '#b0223f', shiftAmount: 0.65, glitch: false },
};
const KEYFRAMES = {
    0: { zenith: '#0a0e1f', upper: '#141a33', horizon: '#2a2f52', ground: '#1c2138', haze: '#26304f', sunMoon: '#dfe6ff', glowRadius: 0.22, glowSoft: 1.0 },
    5: { zenith: '#161c33', upper: '#3a3552', horizon: '#7a5c63', ground: '#caa580', haze: '#9a7d6e', sunMoon: '#ffe2b0', glowRadius: 0.30, glowSoft: 1.1 },
    7: { zenith: '#2b3550', upper: '#9a8266', horizon: '#e8c98a', ground: '#f0dba8', haze: '#dcc193', sunMoon: '#fff3d6', glowRadius: 0.34, glowSoft: 1.15 },
    12: { zenith: '#5d6a72', upper: '#a8a690', horizon: '#d9cfa6', ground: '#e3dab3', haze: '#cdc4a0', sunMoon: '#fbf4dd', glowRadius: 0.22, glowSoft: 0.9 },
    17: { zenith: '#3a3c3a', upper: '#8c8160', horizon: '#d4a843', ground: '#e8c878', haze: '#bfa468', sunMoon: '#ffe9a8', glowRadius: 0.36, glowSoft: 1.2 },
    19: { zenith: '#23242a', upper: '#574a3f', horizon: '#8a5a3f', ground: '#6e4434', haze: '#7a5a4a', sunMoon: '#ffd9a0', glowRadius: 0.30, glowSoft: 1.15 },
    21: { zenith: '#11131f', upper: '#221f33', horizon: '#3c3350', ground: '#2a2640', haze: '#352f4d', sunMoon: '#e8e2ff', glowRadius: 0.24, glowSoft: 1.0 },
    24: { zenith: '#0a0e1f', upper: '#141a33', horizon: '#2a2f52', ground: '#1c2138', haze: '#26304f', sunMoon: '#dfe6ff', glowRadius: 0.22, glowSoft: 1.0 },
};
const WEATHER_TINT = {
    CLEAR: { mul: [1, 1, 1], hazeBoost: 0, desat: 0 },
    OVERCAST: { mul: [0.85, 0.85, 0.88], hazeBoost: 0.15, desat: 0.2 },
    FOG_HEAVY: { mul: [0.9, 0.9, 0.92], hazeBoost: 0.45, desat: 0.3 },
    ACID_RAIN: { mul: [0.75, 0.85, 0.6], hazeBoost: 0.25, desat: 0.1 },
    DEAD_CALM: { mul: [0.95, 0.92, 0.85], hazeBoost: 0.1, desat: 0.15 },
    STATIC_STORM: { mul: [0.7, 0.65, 0.8], hazeBoost: 0.2, desat: 0.05 },
    DUST_EVENT: { mul: [1.05, 0.9, 0.65], hazeBoost: 0.35, desat: 0.1 },
};
const DEFAULT_MOON = { visible: true, phase: 0.5, anomalyActive: false };
const DEFAULT_OBSEDIA = { active: false, intensity: 0 };
// ─── Color math (hex string based, mirrors sky_preview.html exactly) ───
function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r, g, b) {
    const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
}
function lerp(a, b, t) {
    return a + (b - a) * t;
}
function lerpColor(hexA, hexB, t) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    return rgbToHex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
}
function desaturate(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    const gray = r * 0.3 + g * 0.59 + b * 0.11;
    return rgbToHex(lerp(r, gray, amt), lerp(g, gray, amt), lerp(b, gray, amt));
}
function applyTint(hex, mul) {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHex(r * mul[0], g * mul[1], b * mul[2]);
}
function shiftTowards(hex, target, amt) {
    if (!target || amt <= 0)
        return hex;
    return lerpColor(hex, target, amt);
}
function hexWithAlpha(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
// Deterministic seeded RNG (mulberry32) — stars/clouds stay stable per zone seed
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
function getKeyframe(hour) {
    const keys = Object.keys(KEYFRAMES).map(Number).sort((a, b) => a - b);
    let lo = keys[0];
    let hi = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++) {
        if (hour >= keys[i] && hour <= keys[i + 1]) {
            lo = keys[i];
            hi = keys[i + 1];
            break;
        }
    }
    const span = hi - lo || 1;
    const t = (hour - lo) / span;
    const A = KEYFRAMES[lo];
    const B = KEYFRAMES[hi];
    return {
        zenith: lerpColor(A.zenith, B.zenith, t),
        upper: lerpColor(A.upper, B.upper, t),
        horizon: lerpColor(A.horizon, B.horizon, t),
        ground: lerpColor(A.ground, B.ground, t),
        haze: lerpColor(A.haze, B.haze, t),
        sunMoon: lerpColor(A.sunMoon, B.sunMoon, t),
        glowRadius: lerp(A.glowRadius, B.glowRadius, t),
        glowSoft: lerp(A.glowSoft, B.glowSoft, t),
    };
}
export class SkySystem {
    constructor(options = {}) {
        this.timeOfDay = 12;
        this.weatherState = 'CLEAR';
        this.wrongnessState = WrongnessState.SUNNY;
        this.moon = { ...DEFAULT_MOON };
        this.obsediaRain = { ...DEFAULT_OBSEDIA };
        this.baseColor = new THREE.Color();
        this.fogColor = new THREE.Color();
        this.lastComputed = null;
        this.dirty = true;
        this.stars = [];
        this.clouds = [];
        this.glitchSeedTime = 0;
        this._lastFogIntensity = 0.3;
        this.grainCache = null;
        const w = options.textureWidth ?? 512;
        const h = options.textureHeight ?? 512;
        this.grainAmount = options.grainAmount ?? 0.05;
        this.zoneSeed = options.zoneSeed ?? Math.floor(Math.random() * 1e9);
        this.starCount = options.starCount ?? 90;
        this.cloudCount = options.cloudCount ?? 5;
        this.canvas = document.createElement('canvas');
        this.canvas.width = w;
        this.canvas.height = h;
        const ctx = this.canvas.getContext('2d');
        if (!ctx)
            throw new Error('SkySystem: failed to acquire 2D context for sky texture');
        this.ctx = ctx;
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.generateStarsAndClouds();
    }
    init() {
        this.dirty = true;
        this.bake();
    }
    /**
     * Convenience wrapper around update() for once WorldGenerator/ZoneStreamer
     * exist — reads timeOfDay/weatherState/fogIntensity/wrongnessState/seed
     * straight off a Zone instead of hand-building a SkyWorldState each time.
     * Moon and Obsedia Rain aren't on Zone yet (they're world/run-level, not
     * per-zone), so pass those separately via update() if needed alongside this.
     */
    applyZone(zone, deltaTime = 0) {
        this.update(deltaTime, {
            timeOfDay: zone.timeOfDay,
            weatherState: zone.weatherState,
            fogIntensity: zone.fogIntensity,
            wrongnessState: zone.wrongnessState,
            zoneSeed: zone.seed,
        });
    }
    generateStarsAndClouds() {
        const rng = mulberry32(this.zoneSeed);
        this.stars = [];
        for (let i = 0; i < this.starCount; i++) {
            this.stars.push({
                x: rng(),
                y: rng() * 0.6, // keep stars in the upper sky, not near the horizon glow band
                r: 0.5 + rng() * 1.3,
                tw: rng() * Math.PI * 2, // twinkle phase offset
            });
        }
        this.clouds = [];
        for (let i = 0; i < this.cloudCount; i++) {
            this.clouds.push({
                x: rng(),
                y: 0.15 + rng() * 0.35,
                rx: 0.12 + rng() * 0.18,
                ry: 0.03 + rng() * 0.04,
                alpha: 0.15 + rng() * 0.25,
            });
        }
    }
    /** Call once per frame / on zone change. Cheap no-op if nothing relevant changed. */
    update(deltaTime, worldState) {
        this.glitchSeedTime += deltaTime;
        if (worldState) {
            if (worldState.timeOfDay !== undefined && worldState.timeOfDay !== this.timeOfDay) {
                this.timeOfDay = worldState.timeOfDay;
                this.dirty = true;
            }
            if (worldState.weatherState !== undefined && worldState.weatherState !== this.weatherState) {
                this.weatherState = worldState.weatherState;
                this.dirty = true;
            }
            if (worldState.wrongnessState !== undefined && worldState.wrongnessState !== this.wrongnessState) {
                this.wrongnessState = worldState.wrongnessState;
                this.dirty = true;
            }
            if (worldState.moon) {
                const next = { ...this.moon, ...worldState.moon };
                if (next.visible !== this.moon.visible || next.phase !== this.moon.phase || next.anomalyActive !== this.moon.anomalyActive) {
                    this.moon = next;
                    this.dirty = true;
                }
            }
            if (worldState.obsediaRain) {
                const next = { ...this.obsediaRain, ...worldState.obsediaRain };
                if (next.active !== this.obsediaRain.active || next.intensity !== this.obsediaRain.intensity) {
                    this.obsediaRain = next;
                    this.dirty = true;
                }
            }
            if (worldState.zoneSeed !== undefined && worldState.zoneSeed !== this.zoneSeed) {
                this.zoneSeed = worldState.zoneSeed;
                this.generateStarsAndClouds();
                this.dirty = true;
            }
            this._lastFogIntensity = worldState.fogIntensity ?? this._lastFogIntensity;
        }
        // STATIC wrongness or active Obsedia Rain both warrant continuous re-bakes
        // (glitch flicker / rain animation), not just on state-change.
        if (this.wrongnessState === WrongnessState.STATIC || this.obsediaRain.active) {
            this.dirty = true;
        }
        if (this.dirty)
            this.bake();
    }
    setFogIntensity(value) {
        if (value !== this._lastFogIntensity) {
            this._lastFogIntensity = value;
            this.dirty = true;
        }
    }
    /** Randomly trigger/stop Obsedia Rain — call from a world-level random-event ticker. */
    triggerObsediaRain(intensity = 0.6 + Math.random() * 0.4) {
        this.obsediaRain = { active: true, intensity };
        this.dirty = true;
    }
    stopObsediaRain() {
        this.obsediaRain = { active: false, intensity: 0 };
        this.dirty = true;
    }
    getAmbientLight() {
        return this.baseColor.clone();
    }
    getDirectionalLight() {
        const light = new THREE.DirectionalLight(this.baseColor.clone(), this.lastComputed?.isNight ? 0.35 : 1.0);
        if (this.lastComputed) {
            const x = (this.lastComputed.sunX - 0.5) * 20;
            const y = (1 - this.lastComputed.sunY) * 15 + 2;
            const z = 8;
            light.position.set(x, y, z);
        }
        return light;
    }
    getTexture() {
        return this.texture;
    }
    /** Current fog/haze intensity (0–1) — exposed so other render systems (e.g. DustParticles via IsometricRenderer) can read it without duplicating the state SkySystem already tracks. */
    getFogIntensity() {
        return this._lastFogIntensity;
    }
    computeSky() {
        const hour = ((this.timeOfDay % 24) + 24) % 24;
        const kf = getKeyframe(hour);
        const w = WEATHER_TINT[this.weatherState];
        const wr = WRONGNESS_PALETTE[this.wrongnessState];
        let { zenith, upper, horizon, ground, haze, sunMoon } = kf;
        // weather pass
        zenith = applyTint(zenith, w.mul);
        upper = applyTint(upper, w.mul);
        horizon = applyTint(horizon, w.mul);
        ground = applyTint(ground, w.mul);
        haze = applyTint(haze, w.mul);
        if (w.desat > 0) {
            zenith = desaturate(zenith, w.desat);
            upper = desaturate(upper, w.desat);
            horizon = desaturate(horizon, w.desat);
            ground = desaturate(ground, w.desat);
        }
        // wrongness pass (on top of weather — reality-stability axis is separate from environment)
        zenith = applyTint(zenith, wr.tint);
        upper = applyTint(upper, wr.tint);
        horizon = applyTint(horizon, wr.tint);
        ground = applyTint(ground, wr.tint);
        haze = applyTint(haze, wr.tint);
        if (wr.desat > 0) {
            zenith = desaturate(zenith, wr.desat);
            upper = desaturate(upper, wr.desat);
            horizon = desaturate(horizon, wr.desat);
            ground = desaturate(ground, wr.desat);
        }
        if (wr.shiftHex && wr.shiftAmount > 0) {
            zenith = shiftTowards(zenith, wr.shiftHex, wr.shiftAmount);
            upper = shiftTowards(upper, wr.shiftHex, wr.shiftAmount);
            horizon = shiftTowards(horizon, wr.shiftHex, wr.shiftAmount * 0.8);
            ground = shiftTowards(ground, wr.shiftHex, wr.shiftAmount);
            haze = shiftTowards(haze, wr.shiftHex, wr.shiftAmount);
        }
        // Obsedia Rain — bleeds everything toward a dark gooey black, on top of wrongness
        if (this.obsediaRain.active && this.obsediaRain.intensity > 0) {
            const bleed = '#0a0a0c';
            const amt = this.obsediaRain.intensity;
            zenith = lerpColor(zenith, bleed, amt * 0.6);
            upper = lerpColor(upper, bleed, amt * 0.55);
            horizon = lerpColor(horizon, bleed, amt * 0.4);
            ground = lerpColor(ground, bleed, amt * 0.7);
            haze = lerpColor(haze, bleed, amt * 0.5);
        }
        const totalHaze = Math.min(1, this._lastFogIntensity + w.hazeBoost + wr.hazeBoost);
        ground = lerpColor(ground, haze, totalHaze * 0.6);
        horizon = lerpColor(horizon, haze, totalHaze * 0.35);
        // sun arc
        const dayProgress = hour / 24;
        const angle = dayProgress * Math.PI * 2 - Math.PI / 2;
        const sunX = 0.5 + Math.cos(angle) * 0.45;
        let sunY = 0.5 + Math.sin(angle) * 0.6;
        sunY = Math.max(0.08, Math.min(0.78, sunY));
        // moon arc — independent cycle (roughly opposite the sun, slower drift via phase)
        const moonAngle = angle + Math.PI + this.moon.phase * 0.6;
        const moonX = 0.5 + Math.cos(moonAngle) * 0.4;
        let moonY = 0.5 + Math.sin(moonAngle) * 0.55;
        moonY = Math.max(0.06, Math.min(0.7, moonY));
        return {
            zenith, upper, horizon, ground, haze, sunMoon,
            glowRadius: kf.glowRadius,
            glowSoft: kf.glowSoft,
            totalHaze,
            sunX, sunY,
            moonX, moonY,
            isNight: hour < 5.5 || hour > 19.5,
        };
    }
    /** Re-renders the gradient + glow + moon + stars + clouds + grain + rain to canvas, flags texture for upload. */
    bake() {
        const sky = this.computeSky();
        this.lastComputed = sky;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const ctx = this.ctx;
        const isGlitching = this.wrongnessState === WrongnessState.STATIC;
        // base vertical gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0.0, sky.zenith);
        grad.addColorStop(0.35, sky.zenith);
        grad.addColorStop(0.58, sky.upper);
        grad.addColorStop(0.78, sky.horizon);
        grad.addColorStop(0.92, sky.horizon);
        grad.addColorStop(1.0, sky.ground);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        // stars (only read through at night, fade out under heavy haze)
        const starVisibility = (sky.isNight ? 1 : 0) * (1 - Math.min(1, sky.totalHaze * 1.3));
        if (starVisibility > 0.02) {
            for (const s of this.stars) {
                const twinkle = 0.6 + 0.4 * Math.sin(this.glitchSeedTime * 2 + s.tw);
                ctx.beginPath();
                ctx.fillStyle = hexWithAlpha('#ffffff', starVisibility * twinkle * 0.85);
                ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        // procedural clouds — soft radial blobs, opacity scaled by fog/weather
        const cloudStrength = Math.min(1, 0.4 + this._lastFogIntensity);
        for (const c of this.clouds) {
            const cx = c.x * w;
            const cy = c.y * h;
            const rx = c.rx * w;
            const ry = c.ry * h;
            const cloudGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
            const cloudColor = sky.isNight ? '#aab2c8' : '#fff8e8';
            cloudGrad.addColorStop(0, hexWithAlpha(cloudColor, c.alpha * cloudStrength));
            cloudGrad.addColorStop(1, hexWithAlpha(cloudColor, 0));
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
            ctx.translate(-cx, -cy);
            ctx.fillStyle = cloudGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(rx, ry), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        // haze band (depth-melt toward horizon)
        const hazeGrad = ctx.createLinearGradient(0, 0, 0, h);
        const hazeOpacityLow = 0.15 + sky.totalHaze * 0.35;
        const hazeOpacityHigh = 0.25 + sky.totalHaze * 0.5;
        hazeGrad.addColorStop(0.0, hexWithAlpha(sky.haze, 0));
        hazeGrad.addColorStop(0.6, hexWithAlpha(sky.haze, 0));
        hazeGrad.addColorStop(0.8, hexWithAlpha(sky.haze, hazeOpacityLow));
        hazeGrad.addColorStop(1.0, hexWithAlpha(sky.haze, hazeOpacityHigh));
        ctx.fillStyle = hazeGrad;
        ctx.fillRect(0, 0, w, h);
        // sun glow (only meaningfully visible when not deep night)
        const sunStrength = sky.isNight ? 0.12 : 1.0;
        this.drawGlow(ctx, sky.sunX * w, sky.sunY * h, sky.glowRadius * h * sky.glowSoft, sky.sunMoon, sunStrength);
        // moon — tracked persistent object, can show faintly in daytime too
        if (this.moon.visible) {
            const moonStrength = (sky.isNight ? 1.0 : 0.22) * (0.5 + this.moon.phase * 0.5);
            const moonColor = this.moon.anomalyActive ? '#d8f0ff' : '#e9ecff';
            this.drawGlow(ctx, sky.moonX * w, sky.moonY * h, sky.glowRadius * h * 0.85, moonColor, moonStrength);
            if (this.moon.anomalyActive) {
                // extra anomaly ring — Moon Dome plot beat, distinct from normal glow
                this.drawGlow(ctx, sky.moonX * w, sky.moonY * h, sky.glowRadius * h * 1.6, '#7fffe0', 0.25 + 0.15 * Math.sin(this.glitchSeedTime * 1.5));
            }
        }
        // STATIC wrongness — glitch/tear pass, distinct from a plain color shift
        if (isGlitching) {
            this.drawGlitch(ctx, w, h);
        }
        // Obsedia Rain overlay — diagonal dark streaks + gooey bleed vignette
        if (this.obsediaRain.active && this.obsediaRain.intensity > 0) {
            this.drawObsediaRain(ctx, w, h, this.obsediaRain.intensity);
        }
        // grain pass — breaks gradient banding, no hand art needed
        if (this.grainAmount > 0) {
            this.applyGrain(ctx, w, h, this.grainAmount);
        }
        // derive ambient/fog colors from the same palette (single source of truth)
        this.baseColor.set(sky.upper);
        this.fogColor.set(sky.haze);
        this.texture.needsUpdate = true;
        this.dirty = false;
    }
    drawGlow(ctx, cx, cy, r, color, strength) {
        if (strength <= 0.01 || r <= 0)
            return;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        glow.addColorStop(0.0, hexWithAlpha(color, 0.95 * strength));
        glow.addColorStop(0.18, hexWithAlpha(color, 0.55 * strength));
        glow.addColorStop(0.45, hexWithAlpha(color, 0.18 * strength));
        glow.addColorStop(1.0, hexWithAlpha(color, 0));
        ctx.save();
        ctx.filter = 'blur(3px)';
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();
    }
    /** STATIC wrongness: thin horizontal tear bands + RGB-split flicker, randomized per bake. */
    drawGlitch(ctx, w, h) {
        const bandCount = 3 + Math.floor(Math.random() * 4);
        ctx.save();
        for (let i = 0; i < bandCount; i++) {
            const y = Math.random() * h;
            const bandH = 2 + Math.random() * 14;
            const xOffset = (Math.random() - 0.5) * 24;
            ctx.globalCompositeOperation = 'overlay';
            ctx.fillStyle = hexWithAlpha('#8a8fae', 0.25 + Math.random() * 0.25);
            ctx.fillRect(xOffset, y, w, bandH);
        }
        // faint RGB-split flicker line — cheap "veil glitching" tell
        if (Math.random() < 0.6) {
            const y = Math.random() * h;
            ctx.globalCompositeOperation = 'screen';
            ctx.fillStyle = 'rgba(255,40,60,0.12)';
            ctx.fillRect(-3, y, w, 2);
            ctx.fillStyle = 'rgba(40,200,255,0.12)';
            ctx.fillRect(3, y + 2, w, 2);
        }
        ctx.restore();
    }
    /** Obsedia Rain: diagonal dark oil streaks + a gooey dark vignette bleeding from the top. */
    drawObsediaRain(ctx, w, h, intensity) {
        ctx.save();
        // gooey bleed from the top, like the sky itself is dripping
        const bleedGrad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
        bleedGrad.addColorStop(0, hexWithAlpha('#000000', 0.35 * intensity));
        bleedGrad.addColorStop(1, hexWithAlpha('#000000', 0));
        ctx.fillStyle = bleedGrad;
        ctx.fillRect(0, 0, w, h * 0.6);
        // diagonal oil streaks
        const streakCount = Math.floor(12 + intensity * 24);
        ctx.strokeStyle = hexWithAlpha('#050505', 0.5 * intensity);
        ctx.lineWidth = 1.5;
        for (let i = 0; i < streakCount; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h * 0.85;
            const len = 20 + Math.random() * 60;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - len * 0.25, y + len);
            ctx.stroke();
        }
        ctx.restore();
    }
    applyGrain(ctx, w, h, amount) {
        if (!this.grainCache || this.grainCache.width !== w || this.grainCache.height !== h) {
            const imgData = ctx.createImageData(w, h);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                const v = Math.random() * 255;
                data[i] = v;
                data[i + 1] = v;
                data[i + 2] = v;
                data[i + 3] = 255;
            }
            this.grainCache = imgData;
        }
        const off = document.createElement('canvas');
        off.width = w;
        off.height = h;
        const offCtx = off.getContext('2d');
        offCtx.putImageData(this.grainCache, 0, 0);
        ctx.save();
        ctx.globalAlpha = amount;
        ctx.globalCompositeOperation = 'overlay';
        ctx.drawImage(off, 0, 0);
        ctx.restore();
    }
    dispose() {
        this.texture.dispose();
    }
}
//# sourceMappingURL=SkySystem.js.map