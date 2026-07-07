import { WrongnessState } from '../types.js';
import type { Zone } from '../types.js';
import type { GameplayEngine } from '../gameplay/index.js';
import { el, createNoiseCanvas, WRONGNESS_PALETTE, applyThemeVars } from './ui-shared.js';
import type { DrifterAudio } from './DrifterAudio.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GameSettings {
  difficulty: number;
  volume: number;
  showHints: boolean;
}

const SETTINGS_KEY = 'drifter-settings-v1';

export function loadSettings(): GameSettings {
  const defaults: GameSettings = { difficulty: 3, volume: 0.65, showHints: true };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      difficulty: typeof parsed.difficulty === 'number' ? parsed.difficulty : defaults.difficulty,
      volume: typeof parsed.volume === 'number' ? parsed.volume : defaults.volume,
      showHints: typeof parsed.showHints === 'boolean' ? parsed.showHints : defaults.showHints,
    };
  } catch { return defaults; }
}

export function saveSettings(s: GameSettings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (_) {}
}

export type AppMode = 'menu' | 'story' | 'exploration' | 'settings' | 'play' | 'loading' | 'briefing';

// ─── MenuScreen ───────────────────────────────────────────────────────────────
// Owns every screen that isn't the live gameplay viewport:
//   menu / story panel / exploration panel / settings / loading / briefing
//
// Does NOT know about Three.js, GameRuntime, or the render loop.
// Calls back to AppShell via the callbacks passed in the constructor.

export interface MenuScreenCallbacks {
  onStartRun(mode: 'story' | 'exploration'): void;
  onWrongnessChange(state: WrongnessState): void;
  onVolumeChange(volume: number): void;
  onSettingsSave(settings: GameSettings): void;
}

export class MenuScreen {
  private root: HTMLElement;
  private audio: DrifterAudio;
  private callbacks: MenuScreenCallbacks;

  settings: GameSettings;
  wrongnessState: WrongnessState = WrongnessState.GREY;

  private mode: AppMode = 'menu';
  private menuIndex = 0;
  private statusMessage = 'Relay node connection established. Standing by.';

  // Noise interval — tracked so we can clear it when unmounting
  private noiseInterval: ReturnType<typeof setInterval> | null = null;

  // In-game state refs (set externally by AppShell when a run is live)
  currentZone: Zone | null = null;
  engine: GameplayEngine | null = null;

  // Pending run mode (set before briefing screen)
  pendingMode: 'story' | 'exploration' = 'exploration';

  // Menu date — persists within session, increments once per page load
  private menuDateInitialized = false;
  private menuDateValue: Date | null = null;

  private bgFolder: string;

  constructor(rootEl: HTMLElement, audio: DrifterAudio, callbacks: MenuScreenCallbacks) {
    this.root = rootEl;
    this.audio = audio;
    this.callbacks = callbacks;
    this.settings = loadSettings();
    this.bgFolder = this.pickBg();
    void this.bgFolder; // used by rotateBg / pickBg, read via buildBackground caller
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  setMode(mode: AppMode): void {
    this.mode = mode;
  }

  setStatus(msg: string): void {
    this.statusMessage = msg;
  }

  setWrongness(state: WrongnessState): void {
    this.wrongnessState = state;
    applyThemeVars(state);
  }

  rotateBg(): void {
    this.bgFolder = this.pickBg();
  }

  /** Full DOM rebuild for the current mode. */
  render(): void {
    // Clear any previous noise interval before rebuilding
    this.clearNoiseInterval();

    applyThemeVars(this.wrongnessState);
    this.root.innerHTML = '';

    const mode = this.mode;
    const p = WRONGNESS_PALETTE[this.wrongnessState];
    const showAtmosphere = mode !== 'play';

    if (showAtmosphere) this.root.appendChild(this.buildScanlines(p.scanlineOpacity));
    if (showAtmosphere) this.root.appendChild(this.buildNoise(p.noiseOpacity));
    this.root.appendChild(this.buildBackground(p.skyFilter));

    const layout = el('div', { position: 'absolute', inset: '0', zIndex: '10', pointerEvents: 'auto' });

    switch (mode) {
      case 'menu':     layout.appendChild(this.buildMenuOverlay()); break;
      case 'story':
      case 'exploration':
      case 'settings': layout.appendChild(this.buildSplitLayout(mode)); break;
      case 'loading':  layout.appendChild(this.buildLoadingScreen()); break;
      case 'briefing': layout.appendChild(this.buildBriefingScreen()); break;
    }

    this.root.appendChild(layout);
  }

  destroy(): void {
    this.clearNoiseInterval();
    this.root.innerHTML = '';
  }

  // ── Atmosphere ────────────────────────────────────────────────────────────────

  private clearNoiseInterval(): void {
    if (this.noiseInterval !== null) {
      clearInterval(this.noiseInterval);
      this.noiseInterval = null;
    }
  }

  private buildScanlines(opacity: number): HTMLElement {
    const el2 = document.createElement('div');
    el2.id = 'drifter-scanlines';
    Object.assign(el2.style, {
      position: 'fixed', inset: '0', zIndex: '50', pointerEvents: 'none',
      background: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)',
      mixBlendMode: 'multiply',
      opacity: String(opacity),
      transition: 'opacity 1.2s ease',
    });
    return el2;
  }

  private buildNoise(opacity: number): HTMLElement {
    const wrap = document.createElement('div');
    wrap.id = 'drifter-noise';
    Object.assign(wrap.style, {
      position: 'fixed', inset: '0', zIndex: '49', pointerEvents: 'none',
      opacity: String(opacity),
    });

    if (opacity > 0) {
      const refresh = () => {
        wrap.innerHTML = '';
        wrap.appendChild(createNoiseCanvas(1));
      };
      refresh();
      // Store interval ref so we can clear it on next render
      this.noiseInterval = setInterval(refresh, 120);
    }

    return wrap;
  }

  private buildBackground(skyFilter: string): HTMLElement {
    const bg = el('div', { position: 'absolute', inset: '0', zIndex: '0', overflow: 'hidden', pointerEvents: 'none' });

    const base = el('div', {
      position: 'absolute', inset: '0',
      backgroundImage: "url('/assets/wncorelastbastion.png')",
      backgroundSize: 'cover',
      backgroundPosition: 'center bottom',
      filter: `brightness(0.92) ${skyFilter}`,
    });
    bg.appendChild(base);

    // ── Rain overlay ──────────────────────────────────────────────────────────
    // Only shown on RAINY / STORMY / UNKNOWN / DIFFERENT / ANOTHER_SKY.
    // The background image already has baked-in rain texture; this adds
    // a second moving CSS layer on top so it reads as live/animated, not static art.
    const rainStates: WrongnessState[] = [
      WrongnessState.RAINY, WrongnessState.STORMY,
      WrongnessState.UNKNOWN, WrongnessState.DIFFERENT, WrongnessState.ANOTHER_SKY,
    ];
    if (rainStates.includes(this.wrongnessState)) {
      const rainOpacity =
        this.wrongnessState === WrongnessState.RAINY ? 0.18 :
        this.wrongnessState === WrongnessState.STORMY ? 0.28 :
        this.wrongnessState === WrongnessState.UNKNOWN ? 0.22 :
        this.wrongnessState === WrongnessState.DIFFERENT ? 0.32 : 0.40;

      const rainColor =
        (this.wrongnessState === WrongnessState.DIFFERENT || this.wrongnessState === WrongnessState.ANOTHER_SKY)
          ? 'rgba(180, 40, 40, 0.6)'
          : 'rgba(180, 210, 230, 0.6)';

      // Primary rain — wide gaps, 1px strokes, slow fall
      const rain = el('div', { position: 'absolute', inset: '-20% -5%', pointerEvents: 'none', zIndex: '2' });
      Object.assign(rain.style, {
        backgroundImage: `repeating-linear-gradient(
          100deg,
          transparent 0px,
          transparent 60px,
          ${rainColor} 60px,
          ${rainColor} 61px,
          transparent 62px,
          transparent 120px
        )`,
        backgroundSize: '200px 400%',
        animation: 'menu-rain-fall 1.6s linear infinite',
        opacity: String(rainOpacity),
        mixBlendMode: 'screen',
      });
      bg.appendChild(rain);

      // Secondary layer — slightly different angle and speed for parallax depth
      const rain2 = el('div', { position: 'absolute', inset: '-20% -5%', pointerEvents: 'none', zIndex: '2' });
      Object.assign(rain2.style, {
        backgroundImage: `repeating-linear-gradient(
          98deg,
          transparent 0px,
          transparent 90px,
          ${rainColor} 90px,
          ${rainColor} 91px,
          transparent 92px,
          transparent 180px
        )`,
        backgroundSize: '300px 400%',
        animation: 'menu-rain-fall2 2.4s linear infinite',
        opacity: String(rainOpacity * 0.45),
        mixBlendMode: 'screen',
      });
      bg.appendChild(rain2);
    }

    // ── Moon — tints red on high wrongness states ──────────────────────────────
    const moon = document.createElement('div');
    moon.className = 'drifter-moon';
    const redMoonStates: WrongnessState[] = [
      WrongnessState.STORMY, WrongnessState.DIFFERENT, WrongnessState.ANOTHER_SKY,
    ];
    const orangeMoonStates: WrongnessState[] = [WrongnessState.UNKNOWN];
    if (redMoonStates.includes(this.wrongnessState)) {
      moon.classList.add('drifter-moon--red');
    } else if (orangeMoonStates.includes(this.wrongnessState)) {
      moon.classList.add('drifter-moon--orange');
    }
    bg.appendChild(moon);

    // ── Lightning flashes — STORMY / DIFFERENT / ANOTHER_SKY only ─────────────
    const lightningStates: WrongnessState[] = [
      WrongnessState.STORMY, WrongnessState.DIFFERENT, WrongnessState.ANOTHER_SKY,
    ];
    if (lightningStates.includes(this.wrongnessState)) {
      const lightning = el('div', {
        position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '3',
        background: this.wrongnessState === WrongnessState.ANOTHER_SKY
          ? 'rgba(220, 80, 60, 0.18)'
          : 'rgba(200, 220, 255, 0.22)',
        opacity: '0',
        animation: this.wrongnessState === WrongnessState.STORMY
          ? 'menu-lightning 5.5s ease-in-out infinite'
          : this.wrongnessState === WrongnessState.DIFFERENT
          ? 'menu-lightning 3.8s ease-in-out infinite'
          : 'menu-lightning-red 2.8s ease-in-out infinite',
      });
      bg.appendChild(lightning);
    }

    const vignette = el('div', {
      position: 'absolute', inset: '0',
      background: 'linear-gradient(to top, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.0) 48%)',
      pointerEvents: 'none',
      zIndex: '4',
    });
    bg.appendChild(vignette);

    return bg;
  }

  // ── Menu overlay (main menu) ──────────────────────────────────────────────────

  private buildMenuOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'drifter-menu-overlay';

    // Eyebrow at top of nav section
    const nav = el('div', { display: 'flex', flexDirection: 'column', gap: '0px', width: '100%' });

    // Title block
    const titleBlock = el('div', { marginBottom: '36px' });
    titleBlock.appendChild(this.buildTitle());
    nav.appendChild(titleBlock);

    nav.appendChild(this.buildStatusInline());

    const divider = el('div', { height: '1px', background: 'rgba(255,255,255,0.07)', margin: '20px 0 18px' });
    nav.appendChild(divider);

    nav.appendChild(this.buildNavItems());
    nav.appendChild(this.buildTagline());

    overlay.appendChild(nav);
    return overlay;
  }

  private buildTitle(): HTMLElement {
    const wrap = el('div');

    const eyebrow = el('div', {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '0.58rem', letterSpacing: '0.28em',
      textTransform: 'uppercase', color: 'rgba(84,230,164,0.55)', marginBottom: '14px',
    });
    eyebrow.textContent = 'WNCORE · RELAY STATION 7';
    wrap.appendChild(eyebrow);

    // Logbook SVG logo — worn field notebook with burned-in title.
    // Sized via CSS so it scales with the overlay width rather than
    // a fixed pixel dimension; aspect ratio locked by viewBox.
    const logoWrap = el('div');
    logoWrap.className = 'drifter-title';
    Object.assign(logoWrap.style, {
      display: 'block',
      width: 'clamp(220px, 28vw, 380px)',
      marginBottom: '4px',
    });
    logoWrap.innerHTML = `
      <svg viewBox="0 0 380 140" xmlns="http://www.w3.org/2000/svg" aria-label="A Drifter's Tale logbook" style="width:100%;height:auto;display:block;overflow:visible;">
        <defs>
          <!-- Leather cover base gradient -->
          <linearGradient id="lg-cover" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stop-color="#2a1f14"/>
            <stop offset="40%" stop-color="#1e1510"/>
            <stop offset="100%" stop-color="#120d08"/>
          </linearGradient>
          <!-- Spine gradient -->
          <linearGradient id="lg-spine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stop-color="#3a2a1a"/>
            <stop offset="100%" stop-color="#1a1008"/>
          </linearGradient>
          <!-- Page edge gradient -->
          <linearGradient id="lg-pages" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stop-color="#d8c9a8"/>
            <stop offset="100%" stop-color="#b8a888"/>
          </linearGradient>
          <!-- Glow for burned text -->
          <filter id="lg-glow" x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="2.2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <!-- Subtle emboss for cover texture -->
          <filter id="lg-emboss" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="4" result="noise"/>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
          <!-- Scratch texture overlay -->
          <filter id="lg-scratch">
            <feTurbulence type="turbulence" baseFrequency="0.9 0.02" numOctaves="1" seed="7" result="scratches"/>
            <feColorMatrix in="scratches" type="saturate" values="0" result="grey"/>
            <feBlend in="SourceGraphic" in2="grey" mode="multiply"/>
          </filter>
          <clipPath id="lg-cover-clip">
            <rect x="28" y="6" width="340" height="128" rx="3"/>
          </clipPath>
        </defs>

        <!-- Page stack (right edge, visible behind cover) -->
        <rect x="355" y="12" width="8" height="116" rx="1" fill="url(#lg-pages)" opacity="0.9"/>
        <rect x="352" y="14" width="5" height="112" rx="1" fill="#c8b898" opacity="0.6"/>
        <!-- Fine page lines -->
        <line x1="352" y1="28"  x2="363" y2="28"  stroke="#a89878" stroke-width="0.4" opacity="0.5"/>
        <line x1="352" y1="42"  x2="363" y2="42"  stroke="#a89878" stroke-width="0.4" opacity="0.5"/>
        <line x1="352" y1="56"  x2="363" y2="56"  stroke="#a89878" stroke-width="0.4" opacity="0.5"/>
        <line x1="352" y1="70"  x2="363" y2="70"  stroke="#a89878" stroke-width="0.4" opacity="0.5"/>
        <line x1="352" y1="84"  x2="363" y2="84"  stroke="#a89878" stroke-width="0.4" opacity="0.5"/>
        <line x1="352" y1="98"  x2="363" y2="98"  stroke="#a89878" stroke-width="0.4" opacity="0.5"/>
        <line x1="352" y1="112" x2="363" y2="112" stroke="#a89878" stroke-width="0.4" opacity="0.5"/>

        <!-- Spine -->
        <rect x="28" y="6" width="18" height="128" rx="2" fill="url(#lg-spine)"/>
        <!-- Spine stitching -->
        <line x1="36" y1="18"  x2="36" y2="26"  stroke="#4a3520" stroke-width="1.2" stroke-dasharray="2,3" opacity="0.7"/>
        <line x1="36" y1="54"  x2="36" y2="86"  stroke="#4a3520" stroke-width="1.2" stroke-dasharray="2,3" opacity="0.7"/>
        <line x1="36" y1="104" x2="36" y2="122" stroke="#4a3520" stroke-width="1.2" stroke-dasharray="2,3" opacity="0.7"/>
        <!-- Spine edge highlight -->
        <rect x="28" y="6" width="2" height="128" rx="1" fill="rgba(255,200,120,0.08)"/>

        <!-- Cover body -->
        <rect x="46" y="6" width="306" height="128" rx="3" fill="url(#lg-cover)" filter="url(#lg-emboss)"/>

        <!-- Worn corner shadows -->
        <path d="M46,6 L80,6 L46,40 Z" fill="rgba(0,0,0,0.25)" opacity="0.6"/>
        <path d="M352,6 L352,40 L318,6 Z" fill="rgba(0,0,0,0.15)" opacity="0.5"/>
        <path d="M46,134 L46,100 L80,134 Z" fill="rgba(0,0,0,0.3)" opacity="0.7"/>
        <path d="M352,134 L318,134 L352,100 Z" fill="rgba(0,0,0,0.2)" opacity="0.5"/>

        <!-- Horizontal wear lines across leather -->
        <line x1="46" y1="44"  x2="352" y2="44"  stroke="#0a0604" stroke-width="0.6" opacity="0.35"/>
        <line x1="46" y1="96"  x2="352" y2="96"  stroke="#0a0604" stroke-width="0.5" opacity="0.25"/>
        <line x1="60" y1="68"  x2="200" y2="67"  stroke="#0a0604" stroke-width="0.4" opacity="0.18"/>

        <!-- Rivets / binding nails on spine edge -->
        <circle cx="46" cy="22"  r="3.5" fill="#3a2a18" stroke="#5a4020" stroke-width="0.8"/>
        <circle cx="46" cy="22"  r="1.2" fill="#6a5030" opacity="0.7"/>
        <circle cx="46" cy="70"  r="3.5" fill="#3a2a18" stroke="#5a4020" stroke-width="0.8"/>
        <circle cx="46" cy="70"  r="1.2" fill="#6a5030" opacity="0.7"/>
        <circle cx="46" cy="118" r="3.5" fill="#3a2a18" stroke="#5a4020" stroke-width="0.8"/>
        <circle cx="46" cy="118" r="1.2" fill="#6a5030" opacity="0.7"/>

        <!-- Cover border groove (debossed rectangle) -->
        <rect x="58" y="14" width="284" height="112" rx="2"
              fill="none" stroke="rgba(0,0,0,0.55)" stroke-width="1.5"/>
        <rect x="60" y="16" width="280" height="108" rx="1.5"
              fill="none" stroke="rgba(255,180,80,0.06)" stroke-width="0.8"/>

        <!-- DRIFTER FACTION EMBLEM — small compass rose top-left of inner frame -->
        <g transform="translate(76, 36)" opacity="0.55">
          <circle cx="0" cy="0" r="10" fill="none" stroke="rgba(180,140,60,0.5)" stroke-width="0.8"/>
          <line x1="0" y1="-10" x2="0" y2="10" stroke="rgba(180,140,60,0.6)" stroke-width="0.7"/>
          <line x1="-10" y1="0" x2="10" y2="0" stroke="rgba(180,140,60,0.6)" stroke-width="0.7"/>
          <polygon points="0,-8 2,-2 0,0 -2,-2" fill="rgba(200,160,80,0.7)"/>
          <polygon points="0,8 2,2 0,0 -2,2" fill="rgba(160,120,60,0.4)"/>
          <circle cx="0" cy="0" r="2" fill="rgba(200,160,80,0.5)"/>
        </g>

        <!-- Catalog stamp top right -->
        <g transform="translate(310, 28)" opacity="0.4">
          <rect x="-18" y="-8" width="36" height="16" rx="1"
                fill="none" stroke="rgba(180,140,60,0.6)" stroke-width="0.7" stroke-dasharray="2,1.5"/>
          <text x="0" y="4" text-anchor="middle"
                font-family="'Share Tech Mono', monospace" font-size="6" letter-spacing="0.05em"
                fill="rgba(180,140,60,0.8)">CAT.LOG</text>
        </g>

        <!-- MAIN TITLE — burned/embossed into leather -->
        <!-- "A DRIFTER'S" line -->
        <text x="90" y="75"
              font-family="'Share Tech Mono', monospace"
              font-size="28" font-weight="400"
              letter-spacing="0.14em"
              fill="rgba(200,185,155,0.15)"
              filter="url(#lg-emboss)">A DRIFTER'S</text>
        <text x="90" y="75"
              font-family="'Share Tech Mono', monospace"
              font-size="28" font-weight="400"
              letter-spacing="0.14em"
              fill="rgba(220,205,175,0.88)"
              filter="url(#lg-glow)">A DRIFTER'S</text>

        <!-- "TALE" line — slightly larger, more weight -->
        <text x="90" y="108"
              font-family="'Share Tech Mono', monospace"
              font-size="38" font-weight="400"
              letter-spacing="0.22em"
              fill="rgba(200,185,155,0.15)"
              filter="url(#lg-emboss)">TALE</text>
        <text x="90" y="108"
              font-family="'Share Tech Mono', monospace"
              font-size="38" font-weight="400"
              letter-spacing="0.22em"
              fill="rgba(220,205,175,0.92)"
              filter="url(#lg-glow)">TALE</text>

        <!-- Horizontal rule under title text -->
        <line x1="90" y1="116" x2="320" y2="116"
              stroke="rgba(180,150,80,0.3)" stroke-width="0.7"/>

        <!-- Cover edge bevel (light) -->
        <rect x="46" y="6" width="306" height="128" rx="3"
              fill="none" stroke="rgba(255,200,100,0.07)" stroke-width="1"/>

        <!-- Obsedia-style dark stain, bottom right corner of cover -->
        <ellipse cx="320" cy="128" rx="40" ry="18"
                 fill="rgba(0,0,0,0.45)" opacity="0.5"/>
      </svg>
    `;
    wrap.appendChild(logoWrap);

    return wrap;
  }

  private buildStatusInline(): HTMLElement {
    const now = this.getMenuDateTime();
    const signal = this.engine
      ? Math.max(8, Math.min(99, Math.round(this.engine.drifter.signalStrength)))
      : 72;

    const rows: [string, HTMLElement][] = [
      ['SIGNAL STRENGTH', this.buildSignalMeter(signal)],
      ['STATION ID', (() => { const e = el('span', { color: 'var(--text-primary)' }); e.textContent = 'R-23'; return e; })()],
      ['DATE', (() => { const e = el('span', { color: 'var(--text-primary)' }); e.textContent = now.date; return e; })()],
      ['TIME', (() => { const e = el('span', { color: 'var(--text-primary)' }); e.textContent = now.time; return e; })()],
    ];

    const wrap = el('div');
    wrap.className = 'drifter-inline-status';

    for (const [label, valueNode] of rows) {
      const row = el('div');
      row.className = 'drifter-inline-status-row';
      const lbl = el('span');
      lbl.textContent = label;
      row.appendChild(lbl);
      row.appendChild(valueNode);
      wrap.appendChild(row);
    }

    return wrap;
  }

  private buildNavItems(): HTMLElement {
    const wrap = el('div', { display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'auto' });

    const header = el('div', {
      fontFamily: "'Share Tech Mono', monospace", fontSize: '0.56rem',
      letterSpacing: '0.3em', color: 'rgba(120,150,180,0.45)',
      textTransform: 'uppercase', marginBottom: '14px',
    });
    header.textContent = 'SELECT NODE';
    wrap.appendChild(header);

    const items: [string, AppMode][] = [
      ['Experience the Signal', 'story'],
      ['Expedition Run', 'exploration'],
      ['Settings', 'settings'],
    ];

    items.forEach(([label, targetMode], idx) => {
      const item = el('div');
      item.className = 'drifter-menu-item';
      if (idx === this.menuIndex) item.classList.add('active');
      item.textContent = label;
      item.tabIndex = 0;

      item.onclick = () => {
        this.menuIndex = idx;
        this.audio.playSelect();
        this.setMode(targetMode);
        this.render();
      };
      item.onmouseenter = () => {
        this.menuIndex = idx;
        this.audio.playHover();
        // Only update the active indicator — don't full-rebuild
        wrap.querySelectorAll('.drifter-menu-item').forEach((el2, i) => {
          el2.classList.toggle('active', i === idx);
        });
      };
      item.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') item.click();
      };

      wrap.appendChild(item);
    });

    return wrap;
  }

  private buildTagline(): HTMLElement {
    const tag = el('div');
    tag.className = 'drifter-tagline';
    tag.textContent = "THE SIGNAL IS WEAK, BUT IT'S STILL CALLING.";
    return tag;
  }

  // ── Split layout (story / exploration / settings) ─────────────────────────────

  private buildSplitLayout(mode: 'story' | 'exploration' | 'settings'): HTMLElement {
    const wrap = el('div', { position: 'absolute', inset: '0', display: 'flex', pointerEvents: 'none' });
    wrap.className = 'drifter-split-layout';

    const left = el('div', {
      flex: '1', display: 'flex', flexDirection: 'column',
      justifyContent: 'flex-end', padding: '0 0 40px 48px', pointerEvents: 'none',
    });
    left.className = 'drifter-split-left';
    left.appendChild(this.buildTitle());
    wrap.appendChild(left);

    const right = el('div', {
      width: 'clamp(320px, 38vw, 480px)', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', gap: '12px', padding: '32px 40px 32px 20px', pointerEvents: 'auto',
    });
    right.className = 'drifter-split-right';

    // Wrongness badge
    const badgeWrap = el('div', { display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' });
    const badge = document.createElement('div');
    badge.className = 'wrongness-badge';
    badge.innerHTML = `<span class="dot"></span>${WRONGNESS_PALETTE[this.wrongnessState].label}`;
    badgeWrap.appendChild(badge);
    right.appendChild(badgeWrap);

    if (mode === 'story')       right.appendChild(this.buildStoryPanel());
    if (mode === 'exploration') right.appendChild(this.buildExplorationPanel());
    if (mode === 'settings')    right.appendChild(this.buildSettingsPanel());

    const bar = el('div');
    bar.className = 'bottom-bar';
    bar.textContent = `> ${this.statusMessage}`;
    right.appendChild(bar);

    wrap.appendChild(right);
    return wrap;
  }

  private buildStoryPanel(): HTMLElement {
    const panel = el('div');
    panel.className = 'drifter-panel';
    Object.assign(panel.style, { padding: '20px' });

    const hdr = el('div', { fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.2em', color: 'var(--text-secondary)', marginBottom: '14px' });
    hdr.textContent = 'STRUCTURED RUN · CHAPTER 01';
    panel.appendChild(hdr);

    const desc = el('p', { margin: '0 0 16px', fontSize: '0.9rem', lineHeight: '1.65', color: 'var(--text-secondary)' });
    desc.textContent = 'A signal crack opens the world. Reach the relay, log the world, survive the shadows. Structured narrative. Fixed drifter origin. One shot.';
    panel.appendChild(desc);

    const startBtn = el('button');
    startBtn.className = 'drifter-btn';
    startBtn.textContent = 'DEPLOY DRIFTER · CHAPTER 01';
    startBtn.onclick = () => { this.audio.playSelect(); this.callbacks.onStartRun('story'); };
    panel.appendChild(startBtn);

    const backBtn = el('button');
    backBtn.className = 'drifter-btn secondary';
    backBtn.textContent = '← Back to relay';
    backBtn.style.marginTop = '6px';
    backBtn.onclick = () => { this.audio.playBack(); this.setMode('menu'); this.render(); };
    panel.appendChild(backBtn);

    return panel;
  }

  private buildExplorationPanel(): HTMLElement {
    const panel = el('div');
    panel.className = 'drifter-panel';
    Object.assign(panel.style, { padding: '20px' });

    const hdr = el('div', { fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.2em', color: 'var(--text-secondary)', marginBottom: '14px' });
    hdr.textContent = 'OPEN RUN · PROCEDURAL ZONE';
    panel.appendChild(hdr);

    const desc = el('p', { margin: '0 0 16px', fontSize: '0.9rem', lineHeight: '1.65', color: 'var(--text-secondary)' });
    desc.textContent = 'Procedural world. Fresh drifter. Move quietly, observe, catalog, extract. No two runs the same. Permadeath.';
    panel.appendChild(desc);

    const diffWrap = el('div', { marginBottom: '16px' });
    const diffLabel = el('div', { fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.15em', color: 'var(--text-secondary)', marginBottom: '4px' });
    diffLabel.textContent = `DIFFICULTY — ${this.settings.difficulty}`;
    diffWrap.appendChild(diffLabel);

    const slider = el('input');
    slider.type = 'range'; slider.min = '1'; slider.max = '8';
    slider.value = String(this.settings.difficulty);
    slider.oninput = () => {
      this.settings.difficulty = Number(slider.value);
      diffLabel.textContent = `DIFFICULTY — ${this.settings.difficulty}`;
    };
    diffWrap.appendChild(slider);
    panel.appendChild(diffWrap);

    const startBtn = el('button');
    startBtn.className = 'drifter-btn';
    startBtn.textContent = 'DEPLOY DRIFTER · OPEN RUN';
    startBtn.onclick = () => { this.audio.playSelect(); this.callbacks.onStartRun('exploration'); };
    panel.appendChild(startBtn);

    const backBtn = el('button');
    backBtn.className = 'drifter-btn secondary';
    backBtn.textContent = '← Back to relay';
    backBtn.style.marginTop = '6px';
    backBtn.onclick = () => { this.audio.playBack(); this.setMode('menu'); this.render(); };
    panel.appendChild(backBtn);

    return panel;
  }

  private buildSettingsPanel(): HTMLElement {
    const panel = el('div');
    panel.className = 'drifter-panel';
    Object.assign(panel.style, { padding: '20px' });

    const hdr = el('div', { fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.2em', color: 'var(--text-secondary)', marginBottom: '14px' });
    hdr.textContent = '// RELAY SETTINGS';
    panel.appendChild(hdr);

    panel.appendChild(this.makeSlider('VOLUME', 0, 100, Math.round(this.settings.volume * 100), (v) => {
      this.settings.volume = v / 100;
      this.callbacks.onVolumeChange(this.settings.volume);
      this.callbacks.onSettingsSave(this.settings);
    }));

    panel.appendChild(this.makeSlider('DIFFICULTY', 1, 8, this.settings.difficulty, (v) => {
      this.settings.difficulty = v;
      this.callbacks.onSettingsSave(this.settings);
    }));

    const hintRow = el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' });
    const hintLbl = el('span');
    hintLbl.className = 'drifter-label';
    hintLbl.textContent = 'HINTS';
    const hintToggle = el('button');
    hintToggle.className = 'drifter-btn';
    Object.assign(hintToggle.style, { width: 'auto', padding: '6px 14px', fontSize: '0.72rem' });
    hintToggle.textContent = this.settings.showHints ? 'ENABLED' : 'DISABLED';
    hintToggle.onclick = () => {
      this.settings.showHints = !this.settings.showHints;
      hintToggle.textContent = this.settings.showHints ? 'ENABLED' : 'DISABLED';
      this.callbacks.onSettingsSave(this.settings);
    };
    hintRow.appendChild(hintLbl);
    hintRow.appendChild(hintToggle);
    panel.appendChild(hintRow);

    const backBtn = el('button');
    backBtn.className = 'drifter-btn secondary';
    backBtn.textContent = '← Back to relay';
    backBtn.onclick = () => { this.audio.playBack(); this.setMode('menu'); this.render(); };
    panel.appendChild(backBtn);

    return panel;
  }

  private makeSlider(label: string, min: number, max: number, value: number, onChange: (v: number) => void): HTMLElement {
    const wrap = el('div', { marginBottom: '14px' });
    const lbl = el('div');
    lbl.className = 'drifter-label';
    lbl.style.marginBottom = '4px';
    lbl.textContent = `${label} — ${value}`;
    wrap.appendChild(lbl);
    const input = el('input');
    input.type = 'range';
    input.min = String(min); input.max = String(max); input.value = String(value);
    input.oninput = () => { const v = Number(input.value); lbl.textContent = `${label} — ${v}`; onChange(v); };
    wrap.appendChild(input);
    return wrap;
  }

  // ── Loading screen ────────────────────────────────────────────────────────────

  buildLoadingScreen(): HTMLElement {
    const wrap = el('div', {
      position: 'absolute', inset: '0', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '18px',
      background: 'rgba(2,4,8,0.97)', zIndex: '10',
    });

    const lbl = el('div', { fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem', letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(84,230,164,0.7)' });
    lbl.textContent = 'WNCORE · ZONE INITIALISATION';
    wrap.appendChild(lbl);

    const bar = el('div', { width: '220px', height: '2px', background: 'rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' });
    const fill = el('div', { position: 'absolute', top: '0', left: '-60%', width: '60%', height: '100%', background: 'rgba(84,230,164,0.7)', animation: 'drifter-scan 1.1s linear infinite' });
    bar.appendChild(fill);
    wrap.appendChild(bar);

    const sub = el('div', { fontFamily: "'Share Tech Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(160,180,200,0.45)' });
    sub.textContent = 'generating zone · spawning threats · tuning signal';
    wrap.appendChild(sub);

    return wrap;
  }

  // ── Briefing screen ───────────────────────────────────────────────────────────

  buildBriefingScreen(): HTMLElement {
    const zone = this.currentZone;
    const drifter = this.engine?.drifter;
    const mode = this.pendingMode;

    const BRIEFING_LINES: Record<string, string[]> = {
      RAINY: ['Black rain is active in the area. Infected movement slows beneath it. Yours does not.', 'Visibility is reduced. Husks that cannot see you can still hear you.'],
      GREY: ['Overcast sky. No moon tonight. The shadows are clean, which means nothing is hiding in them yet.', 'Move steady. The grey is early-stage. Do not mistake quiet for safe.'],
      STATIC: ['Signal interference detected across the zone. Your relay feed will cut at intervals.', 'Static state. Husk clusters have been observed standing motionless in open ground under these conditions. Do not approach.'],
      STORMY: ['Storm conditions. Loud. Good cover for movement but the Whites use sound differently — they feel pressure, not just vibration.', 'Do not shelter under signal towers. The current draws them.'],
      SUNNY: ['Anomalous clear sky. The early collapse zones logged these as normal days. They were not.', 'Full visibility is a liability as much as an asset. They can see you from the same distance you see them.'],
      BLUE: ['Blue-sky wrongness. Low-grade. Atmosphere has shifted in the upper bands but ground level is still navigable.', 'Trust the field sketch. Do not trust your eyes on anything that is not moving.'],
      UNKNOWN: ['Sky state unclassified. The zone generation is reading anomalous. Proceed with elevated caution.', 'We do not know what is out there. The logbook will tell us after.'],
    };

    const skyKey = String(zone?.wrongnessState ?? 'UNKNOWN');
    const briefingLines = BRIEFING_LINES[skyKey] ?? BRIEFING_LINES['UNKNOWN'];
    const huskCount = this.engine?.huskSystem?.getAllHusks().length ?? 0;
    const zoneName = zone?.name ?? 'UNKNOWN ZONE';
    const zoneType = String(zone?.type ?? '').replace(/_/g, ' ');
    const drifterName = drifter?.name ?? 'DRIFTER';
    const signal = drifter ? Math.round(drifter.signalStrength) : 72;

    // Lower-opacity gradient (was flat 0.96) so the live cinematic camera
    // preview of the zone (AppShell.startRun's this.runtime.enterCinematic())
    // reads through behind the card instead of being fully hidden by it.
    const wrap = el('div', { position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse at center, rgba(2,4,8,0.55) 0%, rgba(2,4,8,0.88) 100%)', zIndex: '10', pointerEvents: 'auto' });
    const card = el('div', { maxWidth: '540px', width: '90%', padding: '32px 36px', background: 'rgba(6,12,22,0.95)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', gap: '20px' });

    const eyebrow = el('div', { fontFamily: "'Share Tech Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(84,230,164,0.65)', marginBottom: '8px' });
    eyebrow.textContent = `WNCORE · ${mode === 'story' ? 'STRUCTURED RUN' : 'OPEN RUN'} · PRE-DEPLOYMENT BRIEF`;
    const nameEl = el('div', { fontFamily: "'Rajdhani', system-ui, sans-serif", fontSize: '1.4rem', fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(220,235,248,0.95)' });
    nameEl.textContent = drifterName;
    const header = el('div');
    header.appendChild(eyebrow);
    header.appendChild(nameEl);
    card.appendChild(header);

    const grid = el('div', { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.66rem', letterSpacing: '0.14em', textTransform: 'uppercase' });
    const stats: [string, string, boolean][] = [
      ['ZONE', zoneName, false], ['TYPE', zoneType, false],
      ['SKY', skyKey.replace(/_/g, ' '), true], ['SIGNAL', `${signal}%`, false],
      ['THREATS', String(huskCount), huskCount > 3],
    ];
    for (const [lbl, val, warn] of stats) {
      const l = el('span', { color: 'rgba(140,165,190,0.6)' }); l.textContent = lbl;
      const v = el('span', { color: warn ? '#ff7a6a' : 'rgba(220,235,248,0.9)' }); v.textContent = val;
      grid.appendChild(l); grid.appendChild(v);
    }
    card.appendChild(grid);

    const divider = el('div', { height: '1px', background: 'rgba(255,255,255,0.07)' });
    card.appendChild(divider);

    const sitrep = el('div', { display: 'flex', flexDirection: 'column', gap: '8px' });
    const sitrepLbl = el('div', { fontFamily: "'Share Tech Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(84,230,164,0.5)', marginBottom: '2px' });
    sitrepLbl.textContent = 'FIELD INTEL';
    sitrep.appendChild(sitrepLbl);
    for (const line of briefingLines) {
      const lineEl = el('div', { fontFamily: "'Share Tech Mono', monospace", fontSize: '0.72rem', lineHeight: '1.65', color: 'rgba(180,200,218,0.75)', letterSpacing: '0.06em' });
      lineEl.textContent = `> ${line}`;
      sitrep.appendChild(lineEl);
    }
    card.appendChild(sitrep);

    const controls = el('div', { fontFamily: "'Share Tech Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(120,145,170,0.5)' });
    controls.textContent = 'WASD / D-PAD · MOVE   E / EXTRACT BTN · EXTRACT   M / MAP BTN · SURVEY   ESC · ABORT';
    card.appendChild(controls);

    const deployBtn = el('button', { padding: '13px 20px', background: 'rgba(84,230,164,0.12)', border: '1px solid rgba(84,230,164,0.5)', color: 'rgba(84,230,164,0.95)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.72rem', letterSpacing: '0.22em', textTransform: 'uppercase', cursor: 'pointer', width: '100%' });
    deployBtn.textContent = 'CONFIRM · ENTER ZONE';
    // Fires AppShell.launchFromBriefing via the mode change
    deployBtn.onclick = () => { this.audio.playDeploy(); this.setMode('play'); this.callbacks.onStartRun(mode); };
    card.appendChild(deployBtn);

    const abortBtn = el('button', { padding: '8px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(140,165,190,0.5)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: 'uppercase', cursor: 'pointer', width: '100%' });
    abortBtn.textContent = 'ABORT · RETURN TO RELAY';
    abortBtn.onclick = () => { this.audio.playAbort(); this.setMode('menu'); this.render(); };
    card.appendChild(abortBtn);

    wrap.appendChild(card);
    return wrap;
  }

  // ── Signal meter ──────────────────────────────────────────────────────────────

  private buildSignalMeter(percent: number): HTMLElement {
    const wrap = el('span');
    wrap.className = 'drifter-signal-value';

    const dot = el('span');
    dot.className = 'drifter-signal-dot';
    if (percent < 15) { dot.style.background = '#ff4a3a'; dot.style.boxShadow = '0 0 10px rgba(255,74,58,0.6)'; }
    else if (percent < 40) { dot.style.background = 'rgba(255,200,80,0.9)'; dot.style.boxShadow = '0 0 10px rgba(255,200,80,0.5)'; }
    wrap.appendChild(dot);

    const meter = el('span');
    meter.className = 'drifter-signal-meter';

    if (percent >= 75) {
      const heights = [7, 11, 14, 10, 13, 8, 12, 9];
      meter.style.alignItems = 'center'; meter.style.gap = '2px';
      for (let i = 0; i < 8; i++) {
        const bar = el('span');
        bar.className = 'sig-wave-bar';
        bar.style.height = `${heights[i]}px`;
        bar.style.animation = `sig-wave-${i} ${0.55 + (i % 4) * 0.08}s ease-in-out infinite`;
        bar.style.animationDelay = `${i * 0.065}s`;
        meter.appendChild(bar);
      }
    } else if (percent >= 40) {
      const arcPct = Math.round((percent / 100) * 85 + 5);
      const arcWrap = el('span', { position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', flexShrink: '0' });
      const ring = el('span', { display: 'inline-block', width: '24px', height: '24px', borderRadius: '50%', border: '1px dashed rgba(84,230,164,0.2)', position: 'absolute', pointerEvents: 'none' });
      const arc = el('span', { display: 'inline-block', width: '18px', height: '18px', borderRadius: '50%', background: `conic-gradient(var(--accent-color) ${arcPct}%, rgba(255,255,255,0.08) ${arcPct}%)`, animation: 'sig-arc-spin 2.4s linear infinite, sig-arc-pulse 1.6s ease-in-out infinite', boxShadow: '0 0 8px rgba(84,230,164,0.25)', flexShrink: '0' });
      arcWrap.appendChild(ring); arcWrap.appendChild(arc);
      meter.appendChild(arcWrap);
    } else if (percent >= 15) {
      meter.style.gap = '4px'; meter.style.alignItems = 'center';
      for (const [anim, width] of [['sig-morse-long', 28], ['sig-morse-short', 18], ['sig-morse-dot', 6]] as [string, number][]) {
        const dash = el('span');
        dash.className = 'sig-morse-dash';
        dash.style.width = `${width}px`;
        dash.style.animation = `${anim} 1.8s ease-in-out infinite`;
        meter.appendChild(dash);
      }
    } else {
      meter.style.gap = '2px'; meter.style.alignItems = 'center';
      const anims = ['sig-static-a', 'sig-static-b', 'sig-static-c', 'sig-static-b', 'sig-static-a'];
      const widths = [10, 7, 14, 6, 9];
      for (let i = 0; i < 5; i++) {
        const block = el('span', { display: 'inline-block', width: `${widths[i]}px`, height: '6px', borderRadius: '1px', background: i % 2 === 0 ? '#ff4a3a' : 'rgba(255,74,58,0.4)', animation: `${anims[i]} ${0.28 + i * 0.07}s steps(1) infinite`, animationDelay: `${i * 0.04}s` });
        meter.appendChild(block);
      }
    }

    wrap.appendChild(meter);

    const txt = el('span', { color: percent < 15 ? '#ff4a3a' : percent < 40 ? 'rgba(255,200,80,0.9)' : 'var(--text-primary)', marginLeft: '6px', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.68rem', letterSpacing: '0.1em' });
    txt.textContent = `${percent}%`;
    wrap.appendChild(txt);

    return wrap;
  }

  // ── In-game HUD ───────────────────────────────────────────────────────────────
  // Called by AppShell when mode === 'play', receives GameRuntime elements.

  buildPlayHUD(
    runtime: { canvas: HTMLCanvasElement; minimapCanvas: HTMLCanvasElement; worldMapCanvas: HTMLCanvasElement; broadcastElement: HTMLDivElement; handleResize(): void },
    onMenu: () => void,
  ): HTMLElement {
    const surface = el('div', { position: 'absolute', inset: '0', zIndex: '2', pointerEvents: 'none' });

    const canvasWrap = el('div', { position: 'absolute', inset: '0', zIndex: '0', pointerEvents: 'none' });
    const canvas = runtime.canvas;
    Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block', pointerEvents: 'none', filter: 'contrast(1.04) saturate(1.05)' });
    canvasWrap.appendChild(canvas);
    surface.appendChild(canvasWrap);

    // HUD top bar
    const hud = el('div', { position: 'absolute', left: '24px', top: '24px', right: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', zIndex: '3', pointerEvents: 'none' });

    const missionPanel = el('div', { maxWidth: '420px', padding: '14px 16px', background: 'rgba(4, 8, 15, 0.64)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' });
    const engine = this.engine;
    const zone = this.currentZone;
    const portraitSeed = engine ? Math.abs(Math.round(Number(engine.drifter.drifterSeed) || 1)) : 1;
    const portraitVariant = (portraitSeed % 3) + 1;
    const portraitPath = `/assets/characters/drifter/portraits/drifter/swat_${portraitVariant}/calm.png`;
    const hintsHtml = this.settings.showHints
      ? `<div style="font-family:'Share Tech Mono',monospace;font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-secondary);margin-top:4px;">WASD · MOVE &nbsp; E · EXTRACT &nbsp; M · SURVEY MAP &nbsp; ESC · RELAY</div>`
      : '';
    missionPanel.innerHTML = `
      <div style="display:flex;gap:12px;align-items:flex-start;">
        <img src="${portraitPath}" alt="" onerror="this.style.display='none'" style="width:56px;height:56px;object-fit:cover;object-position:top;image-rendering:pixelated;border:1px solid rgba(255,255,255,0.18);background:#0a0f16;flex-shrink:0;" />
        <div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:0.64rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--text-secondary);margin-bottom:6px;">RUN STATUS · ${engine?.drifter.name ?? 'DRIFTER'}</div>
          <div style="font-family:'Rajdhani',system-ui,sans-serif;font-size:1rem;font-weight:400;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-primary);margin-bottom:4px;">${zone?.name ?? 'RELAY ZONE'}</div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:0.72rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--text-secondary);">${engine ? Math.round(engine.drifter.signalStrength) : 0}% SIGNAL</div>
          ${hintsHtml}
        </div>
      </div>
    `;
    hud.appendChild(missionPanel);

    const infoPanel = el('div', { padding: '14px 16px', background: 'rgba(4, 8, 15, 0.64)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.68rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-secondary)', lineHeight: '1.8', minWidth: '200px' });
    const skyState = String(zone?.wrongnessState ?? 'UNKNOWN').replace(/_/g, ' ');
    const huskCount = engine?.huskSystem?.getAllHusks().length ?? 0;
    infoPanel.innerHTML = `
      <div style="color:rgba(84,230,164,0.7);margin-bottom:4px;font-size:0.58rem;letter-spacing:0.22em;">WNCORE RELAY · LIVE UPLINK</div>
      <div>SKY &nbsp;<span style="color:var(--text-primary)">${skyState}</span></div>
      <div>ZONE &nbsp;<span style="color:var(--text-primary)">${zone?.name ?? 'UNKNOWN'}</span></div>
      <div>TYPE &nbsp;<span style="color:var(--text-primary)">${String(zone?.type ?? '').replace(/_/g, ' ')}</span></div>
      <div>THREATS &nbsp;<span style="color:${huskCount > 3 ? '#ff7a6a' : 'var(--text-primary)'}">${huskCount}</span></div>
    `;
    hud.appendChild(infoPanel);
    surface.appendChild(hud);

    // Minimap
    const minimapWrap = el('div', { position: 'absolute', right: '24px', bottom: '24px', zIndex: '3', pointerEvents: 'none', padding: '8px', background: 'rgba(4, 8, 15, 0.64)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' });
    const minimapLabel = el('div', { fontFamily: "'Share Tech Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '5px', textAlign: 'center' });
    minimapLabel.textContent = 'FIELD SKETCH';
    minimapWrap.appendChild(minimapLabel);
    minimapWrap.appendChild(runtime.minimapCanvas);
    surface.appendChild(minimapWrap);

    surface.appendChild(runtime.worldMapCanvas);
    surface.appendChild(runtime.broadcastElement);

    // Atmosphere overlays
    surface.appendChild(el('div', { position: 'absolute', inset: '0', zIndex: '1', pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,0.42) 100%)' }));
    surface.appendChild(el('div', { position: 'absolute', inset: '0', zIndex: '1', pointerEvents: 'none', background: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 4px)', mixBlendMode: 'multiply' }));
    const grain = createNoiseCanvas(0.018);
    grain.style.zIndex = '1';
    surface.appendChild(grain);

    // Goal / health HUD (populated by GameRuntime.attachGoalHUD)
    const goalHud = el('div', {
      position: 'absolute', left: '24px', bottom: '72px', zIndex: '4',
      padding: '10px 14px', background: 'rgba(4, 8, 15, 0.72)',
      border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
      pointerEvents: 'none', minWidth: '240px',
    }) as HTMLDivElement;
    goalHud.id = 'drifter-goal-hud';
    surface.appendChild(goalHud);

    const backBtn = el('button', { padding: '10px 14px', background: 'rgba(4, 8, 15, 0.86)', border: '1px solid rgba(255,255,255,0.18)', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace", fontSize: '0.68rem', letterSpacing: '0.16em', textTransform: 'uppercase', backdropFilter: 'blur(8px)', position: 'absolute', left: '24px', bottom: '24px', zIndex: '4', pointerEvents: 'auto' });
    backBtn.textContent = '← MAIN MENU';
    backBtn.onclick = () => { this.audio.playBack(); onMenu(); };
    surface.appendChild(backBtn);

    return surface;
  }

  // ── Date/time ─────────────────────────────────────────────────────────────────

  private getMenuDateTime(): { date: string; time: string } {
    const KEY = 'drifter-menu-current-date-v4';
    const start = new Date(2032, 1, 7, 0, 0, 0);

    if (!this.menuDateInitialized) {
      ['drifter-menu-current-date-v2', 'drifter-menu-current-date-v3', 'drifter-menu-refresh-count'].forEach(k => sessionStorage.removeItem(k));

      const stored = sessionStorage.getItem(KEY);
      const parsed = stored ? new Date(stored) : null;
      const display = parsed && !Number.isNaN(parsed.getTime()) ? new Date(parsed) : new Date(start);
      const next = new Date(display);
      next.setDate(next.getDate() + 1);
      sessionStorage.setItem(KEY, next.toISOString());
      this.menuDateValue = display;
      this.menuDateInitialized = true;
    }

    const date = this.menuDateValue ?? start;
    const hours = Math.floor(Math.random() * 24);
    const minutes = Math.floor(Math.random() * 60);
    const timeDate = new Date(date);
    timeDate.setHours(hours, minutes, 0, 0);

    return {
      date: `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`,
      time: timeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  }

  private pickBg(): string {
    const folders = ['background 1', 'background 2', 'background 3', 'background 4'];
    return folders[Math.floor(Math.random() * folders.length)];
  }
}
