/**
 * AtmosphereController
 * Step 2.7 in the rendering build order (... -> DustParticles ->
 * AtmosphereController -> TextureCache/ZoneStreamer).
 *
 * Owns the screen-space "camera lens" layer — vignette, rain-on-glass,
 * chromatic aberration/glitch, Obsedia Rain foreground drips — as plain
 * CSS+SVG DOM overlays sitting as a sibling over the game canvas, per the
 * plan doc's "CSS+SVG screen-space presets" line item. Deliberately NOT
 * Three.js: these are viewport-space effects (they shouldn't move with the
 * camera or get caught up in the isometric scene's lighting/fog), and CSS
 * gives cheap, GPU-composited overlays without spending render-target
 * budget PixelPipeline/GodRayLayer/DustParticles already use.
 *
 * Distinct from SkySystem's WrongnessState handling: SkySystem changes
 * what the WORLD's sky looks like (baked into its texture). This class
 * changes what the PLAYER'S VIEW looks like (vignette/aberration/rain on
 * "the lens" itself) — same source state (WrongnessState/WeatherType/
 * Obsedia Rain), two different visual layers, intentionally separated so
 * either can be tuned without touching the other's bake logic.
 *
 * Usage:
 *   const atmosphere = new AtmosphereController(canvasContainerEl);
 *   // each frame / on zone or state change:
 *   atmosphere.update({ wrongnessState, weatherState, obsediaRain, decayLevel });
 *   // on resize:
 *   atmosphere.handleResize();
 */
import { WrongnessState } from './SkySystem.js';
// Hand-authored per WrongnessState — same "discrete states, not generated"
// principle SkySystem's KEYFRAMES/WRONGNESS_PALETTE already follow.
const VIGNETTE_PRESETS = {
    SUNNY: { color: '0, 0, 0', strength: 0.12 },
    BLUE: { color: '10, 15, 40', strength: 0.16 },
    GREY: { color: '20, 20, 25', strength: 0.22 },
    RAINY: { color: '15, 20, 30', strength: 0.28 },
    STATIC: { color: '40, 30, 60', strength: 0.32 },
    UNKNOWN: { color: '50, 20, 60', strength: 0.38 },
    STORMY: { color: '35, 10, 45', strength: 0.45 },
    DIFFERENT: { color: '70, 10, 35', strength: 0.52 },
    ANOTHER_SKY: { color: '110, 10, 25', strength: 0.6 },
};
// Rain-streak overlay applies for these weather/wrongness states; intensity
// scales further by decayLevel and (for Obsedia) its own intensity field.
const RAIN_WEATHER = new Set(['ACID_RAIN']);
const RAIN_WRONGNESS = new Set([WrongnessState.RAINY, WrongnessState.STORMY]);
export class AtmosphereController {
    constructor(container) {
        this.styleEl = null;
        this.glitchTimer = 0;
        this.nextGlitchAt = 0;
        this.lastState = null;
        this.container = container;
        this.injectStyles();
        this.root = document.createElement('div');
        this.root.className = 'drifter-atmosphere-root';
        this.vignetteEl = document.createElement('div');
        this.vignetteEl.className = 'drifter-atmosphere-vignette';
        this.rainEl = document.createElement('div');
        this.rainEl.className = 'drifter-atmosphere-rain';
        this.obsediaEl = document.createElement('div');
        this.obsediaEl.className = 'drifter-atmosphere-obsedia';
        this.glitchEl = document.createElement('div');
        this.glitchEl.className = 'drifter-atmosphere-glitch';
        this.root.append(this.vignetteEl, this.rainEl, this.obsediaEl, this.glitchEl);
        // Ensure the container can host an absolutely-positioned overlay
        // sibling correctly — only set if not already positioned, so this
        // doesn't fight a caller's existing layout.
        const computedPosition = getComputedStyle(this.container).position;
        if (computedPosition === 'static') {
            this.container.style.position = 'relative';
        }
        this.container.appendChild(this.root);
    }
    injectStyles() {
        if (document.getElementById('drifter-atmosphere-styles'))
            return; // idempotent — safe if multiple instances exist
        this.styleEl = document.createElement('style');
        this.styleEl.id = 'drifter-atmosphere-styles';
        this.styleEl.textContent = /* css */ `
      .drifter-atmosphere-root {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
        z-index: 10;
      }
      .drifter-atmosphere-vignette {
        position: absolute;
        inset: 0;
        background: radial-gradient(
          ellipse at center,
          rgba(0,0,0,0) 40%,
          rgba(var(--vig-color, 0,0,0), var(--vig-strength, 0.15)) 100%
        );
        transition: background 0.6s ease;
      }
      .drifter-atmosphere-rain {
        position: absolute;
        inset: -10% -10% -10% -10%; /* overscan so the diagonal streak pattern has no visible seam at the edges */
        opacity: var(--rain-opacity, 0);
        background-image: repeating-linear-gradient(
          100deg,
          rgba(180, 200, 220, 0.25) 0px,
          rgba(180, 200, 220, 0.25) 1px,
          transparent 2px,
          transparent 14px
        );
        background-size: 100% 220%;
        animation: drifter-rain-fall 0.35s linear infinite;
        mix-blend-mode: screen;
        transition: opacity 0.5s ease;
      }
      @keyframes drifter-rain-fall {
        from { background-position: 0 0; }
        to   { background-position: 0 60px; }
      }
      .drifter-atmosphere-obsedia {
        position: absolute;
        inset: -10%;
        opacity: var(--obsedia-opacity, 0);
        background:
          repeating-linear-gradient(
            105deg,
            rgba(5, 5, 5, 0.5) 0px,
            rgba(5, 5, 5, 0.5) 2px,
            transparent 3px,
            transparent 22px
          ),
          linear-gradient(
            to bottom,
            rgba(0,0,0,0.35) 0%,
            rgba(0,0,0,0) 35%
          );
        background-size: 100% 180%, 100% 100%;
        animation: drifter-obsedia-fall 0.5s linear infinite;
        transition: opacity 1.2s ease; /* slower fade — Obsedia Rain onset should feel ominous, not snappy */
      }
      @keyframes drifter-obsedia-fall {
        from { background-position: 0 0, 0 0; }
        to   { background-position: 0 90px, 0 0; }
      }
      .drifter-atmosphere-glitch {
        position: absolute;
        inset: 0;
        opacity: 0;
        background: linear-gradient(
          90deg,
          rgba(255,40,60,0.18) 0%,
          transparent 2%,
          transparent 98%,
          rgba(40,200,255,0.18) 100%
        );
        mix-blend-mode: screen;
      }
      .drifter-atmosphere-glitch.is-active {
        opacity: 1;
        animation: drifter-glitch-tear 0.18s steps(2, end);
      }
      @keyframes drifter-glitch-tear {
        0%   { transform: translateX(0) scaleY(1); }
        30%  { transform: translateX(-6px) scaleY(1.01); }
        60%  { transform: translateX(5px) scaleY(0.99); }
        100% { transform: translateX(0) scaleY(1); }
      }
    `;
        document.head.appendChild(this.styleEl);
    }
    /**
     * Call on zone/state change AND ideally once per frame (or on a coarser
     * tick — e.g. every 100ms is plenty, this is CSS not a render pass) with
     * deltaTime so the STATIC glitch flicker and rain/obsedia intensity stay
     * alive without needing a separate ticking mechanism of their own.
     */
    update(state, deltaTime = 0) {
        this.lastState = state;
        const preset = VIGNETTE_PRESETS[state.wrongnessState];
        // vignette: base preset strength + decayLevel pushes it further, capped at 0.85 so it never fully blacks the view
        const vigStrength = Math.min(0.85, preset.strength + state.decayLevel * 0.25);
        this.root.style.setProperty('--vig-color', preset.color);
        this.root.style.setProperty('--vig-strength', vigStrength.toFixed(3));
        // rain-on-glass: weather OR wrongness can trigger it independently (they're separate axes per SkySystem's design)
        const rainActive = RAIN_WEATHER.has(state.weatherState) || RAIN_WRONGNESS.has(state.wrongnessState);
        const rainOpacity = rainActive ? Math.min(1, 0.35 + state.decayLevel * 0.3) : 0;
        this.root.style.setProperty('--rain-opacity', rainOpacity.toFixed(3));
        // Obsedia Rain: separate, stronger, slower-fading layer — never mixes with the regular rain streak pattern
        const obsediaOpacity = state.obsediaRainActive ? Math.min(1, 0.4 + state.obsediaRainIntensity * 0.6) : 0;
        this.root.style.setProperty('--obsedia-opacity', obsediaOpacity.toFixed(3));
        // STATIC glitch flicker — screen-space companion to SkySystem's own
        // in-texture tear pass; randomized timing so they don't look
        // mechanically synced even though they share the same trigger state
        if (state.wrongnessState === WrongnessState.STATIC) {
            this.glitchTimer += deltaTime;
            if (this.glitchTimer >= this.nextGlitchAt) {
                this.triggerGlitchPulse();
                this.glitchTimer = 0;
                this.nextGlitchAt = 0.4 + Math.random() * 1.6;
            }
        }
    }
    /** Returns the most recently applied state — useful for other systems (e.g. a debug HUD, or HazardSystem checking current atmosphere) to read without re-deriving it. */
    getLastState() {
        return this.lastState;
    }
    triggerGlitchPulse() {
        this.glitchEl.classList.remove('is-active');
        // force reflow so re-adding the class restarts the CSS animation even if triggered again quickly
        void this.glitchEl.offsetWidth;
        this.glitchEl.classList.add('is-active');
    }
    /** No-op placeholder for symmetry with other render-system classes' resize hooks — CSS overlay sizes itself via `inset: 0`, nothing to recompute. */
    handleResize() {
        // intentionally empty
    }
    dispose() {
        this.root.remove();
        // styleEl is shared (id-guarded) across instances — only remove it if
        // this was the last AtmosphereController on the page.
        if (!document.querySelector('.drifter-atmosphere-root')) {
            this.styleEl?.remove();
        }
    }
}
export { WrongnessState };
//# sourceMappingURL=AtmosphereController.js.map