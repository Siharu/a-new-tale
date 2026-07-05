import type { Zone } from '../types.js';
import { WrongnessState } from '../types.js';
import { WorldGenerator } from '../worldgen.js';
import { GameplayEngine } from '../gameplay/index.js';
import { GameRuntime } from './GameRuntime.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const MENU_BACKGROUND_FOLDERS = [
  'background 1',
  'background 2',
  'background 3',
  'background 4',
] as const;
type MenuBackgroundFolder = (typeof MENU_BACKGROUND_FOLDERS)[number];

// Fixed path — was '/assets/ui/menu' (wrong), now '/assets/ui/menubackground' (correct)
const MENU_BACKGROUND_PATH_ROOT = '/assets/ui/menubackground';

// Wrongness state → visual palette for UI panels
const WRONGNESS_PALETTE: Record<WrongnessState, {
  panelBg: string;
  borderColor: string;
  accentColor: string;
  textPrimary: string;
  textSecondary: string;
  noiseOpacity: number;
  scanlineOpacity: number;
  glitch: boolean;
  label: string;
  skyFilter: string;
}> = {
  [WrongnessState.SUNNY]: {
    panelBg: 'rgba(12, 18, 28, 0.72)',
    borderColor: 'rgba(180, 210, 255, 0.18)',
    accentColor: '#8bbfff',
    textPrimary: '#ddeeff',
    textSecondary: '#8aaccc',
    noiseOpacity: 0.03,
    scanlineOpacity: 0.0,
    glitch: false,
    label: 'SUNNY',
    skyFilter: 'brightness(0.85) saturate(1.1)',
  },
  [WrongnessState.BLUE]: {
    panelBg: 'rgba(8, 16, 32, 0.76)',
    borderColor: 'rgba(100, 160, 255, 0.22)',
    accentColor: '#6aadff',
    textPrimary: '#cce0ff',
    textSecondary: '#6a96c0',
    noiseOpacity: 0.04,
    scanlineOpacity: 0.03,
    glitch: false,
    label: 'BLUE',
    skyFilter: 'brightness(0.8) hue-rotate(-10deg) saturate(1.15)',
  },
  [WrongnessState.GREY]: {
    panelBg: 'rgba(10, 14, 20, 0.8)',
    borderColor: 'rgba(140, 160, 180, 0.2)',
    accentColor: '#aac4d8',
    textPrimary: '#c8d8e8',
    textSecondary: '#7a90a0',
    noiseOpacity: 0.06,
    scanlineOpacity: 0.06,
    glitch: false,
    label: 'GREY',
    skyFilter: 'brightness(0.72) saturate(0.6) contrast(1.05)',
  },
  [WrongnessState.RAINY]: {
    panelBg: 'rgba(6, 12, 22, 0.84)',
    borderColor: 'rgba(80, 130, 190, 0.25)',
    accentColor: '#5a9fcc',
    textPrimary: '#b0cce0',
    textSecondary: '#5a7a96',
    noiseOpacity: 0.08,
    scanlineOpacity: 0.1,
    glitch: false,
    label: 'RAINY',
    skyFilter: 'brightness(0.62) saturate(0.45) hue-rotate(-15deg)',
  },
  [WrongnessState.STATIC]: {
    panelBg: 'rgba(8, 10, 18, 0.86)',
    borderColor: 'rgba(160, 160, 200, 0.3)',
    accentColor: '#c0c8e0',
    textPrimary: '#c0c8e0',
    textSecondary: '#6a7090',
    noiseOpacity: 0.14,
    scanlineOpacity: 0.16,
    glitch: true,
    label: 'STATIC',
    skyFilter: 'brightness(0.58) saturate(0.2) contrast(1.1)',
  },
  [WrongnessState.UNKNOWN]: {
    panelBg: 'rgba(10, 8, 20, 0.88)',
    borderColor: 'rgba(180, 140, 255, 0.25)',
    accentColor: '#b08de0',
    textPrimary: '#c8b8f0',
    textSecondary: '#7060a0',
    noiseOpacity: 0.18,
    scanlineOpacity: 0.2,
    glitch: true,
    label: 'UNKNOWN',
    skyFilter: 'brightness(0.52) saturate(0.3) hue-rotate(30deg)',
  },
  [WrongnessState.STORMY]: {
    panelBg: 'rgba(6, 6, 14, 0.92)',
    borderColor: 'rgba(200, 160, 80, 0.3)',
    accentColor: '#d0a040',
    textPrimary: '#e0c880',
    textSecondary: '#806030',
    noiseOpacity: 0.22,
    scanlineOpacity: 0.28,
    glitch: true,
    label: 'STORMY',
    skyFilter: 'brightness(0.45) saturate(0.2) sepia(0.3) contrast(1.15)',
  },
  [WrongnessState.DIFFERENT]: {
    panelBg: 'rgba(8, 4, 18, 0.92)',
    borderColor: 'rgba(255, 80, 80, 0.3)',
    accentColor: '#ff6060',
    textPrimary: '#ffc0c0',
    textSecondary: '#804040',
    noiseOpacity: 0.28,
    scanlineOpacity: 0.35,
    glitch: true,
    label: 'A DIFFERENT SKY',
    skyFilter: 'brightness(0.38) saturate(0.15) hue-rotate(160deg) contrast(1.2)',
  },
  [WrongnessState.ANOTHER_SKY]: {
    panelBg: 'rgba(4, 0, 12, 0.96)',
    borderColor: 'rgba(255, 40, 40, 0.4)',
    accentColor: '#ff3030',
    textPrimary: '#ffaaaa',
    textSecondary: '#602020',
    noiseOpacity: 0.35,
    scanlineOpacity: 0.45,
    glitch: true,
    label: 'ANOTHER SKY',
    skyFilter: 'brightness(0.3) saturate(0.1) hue-rotate(180deg) contrast(1.3)',
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface GameSettings {
  difficulty: number;
  volume: number;
  showHints: boolean;
}

const SETTINGS_STORAGE_KEY = 'drifter-settings-v1';

function loadSettings(): GameSettings {
  const defaults: GameSettings = { difficulty: 3, volume: 0.65, showHints: true };
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      difficulty: typeof parsed.difficulty === 'number' ? parsed.difficulty : defaults.difficulty,
      volume: typeof parsed.volume === 'number' ? parsed.volume : defaults.volume,
      showHints: typeof parsed.showHints === 'boolean' ? parsed.showHints : defaults.showHints,
    };
  } catch {
    return defaults;
  }
}

function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable — settings stay session-only
  }
}

type AppMode = 'menu' | 'story' | 'exploration' | 'settings' | 'play' | 'loading' | 'briefing';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function el<K extends keyof HTMLElementTagNameMap>(tag: K, styles?: Partial<CSSStyleDeclaration>): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (styles) Object.assign(e.style, styles);
  return e;
}

function injectGlobalStyles(): void {
  if (document.getElementById('drifter-global-styles')) return;
  const style = document.createElement('style');
  style.id = 'drifter-global-styles';
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Rubik+Glitch&family=VT323&family=Share+Tech+Mono&family=Rajdhani:wght@400;500;600;700&display=swap');

    *, *::before, *::after { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      background: #060a12;
      color: #ddeeff;
      font-family: 'Rajdhani', system-ui, sans-serif;
      overflow: hidden;
    }

    #app {
      position: relative;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    }

    /* Scanline overlay — full screen */
    #drifter-scanlines {
      position: fixed;
      inset: 0;
      z-index: 50;
      pointer-events: none;
      background: repeating-linear-gradient(
        to bottom,
        transparent 0px,
        transparent 3px,
        rgba(0,0,0,0.08) 3px,
        rgba(0,0,0,0.08) 4px
      );
      mix-blend-mode: multiply;
      transition: opacity 1.2s ease;
    }

    /* Noise overlay */
    #drifter-noise {
      position: fixed;
      inset: 0;
      z-index: 49;
      pointer-events: none;
      opacity: 0;
      transition: opacity 1.2s ease;
    }

    /* Glitch keyframes */
    @keyframes glitch-h {
      0%, 95%, 100% { clip-path: none; transform: none; }
      96% { clip-path: inset(10% 0 80% 0); transform: translateX(-4px); }
      97% { clip-path: inset(60% 0 20% 0); transform: translateX(4px); }
      98% { clip-path: none; transform: translateX(-2px); }
    }

    @keyframes glitch-border {
      0%, 92%, 100% { border-color: var(--border-color); box-shadow: none; }
      93% { border-color: rgba(255,60,60,0.5); box-shadow: 0 0 8px rgba(255,60,60,0.3); }
      94% { border-color: rgba(60,180,255,0.5); box-shadow: 0 0 8px rgba(60,180,255,0.3); }
      95% { border-color: var(--border-color); box-shadow: none; }
    }

    @keyframes signal-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    @keyframes status-dot-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.2; }
    }

    @keyframes text-flicker {
      0%, 97%, 100% { opacity: 1; }
      98% { opacity: 0.3; }
      99% { opacity: 0.8; }
    }

    /* ── Signal tier animations ── */

    /* Tier 1 (75-100%): waveform bars */
    @keyframes sig-wave-0 { 0%,100%{transform:scaleY(0.3)} 30%{transform:scaleY(1)} }
    @keyframes sig-wave-1 { 0%,100%{transform:scaleY(0.5)} 45%{transform:scaleY(1)} }
    @keyframes sig-wave-2 { 0%,100%{transform:scaleY(0.2)} 55%{transform:scaleY(1)} }
    @keyframes sig-wave-3 { 0%,100%{transform:scaleY(0.6)} 35%{transform:scaleY(1)} }
    @keyframes sig-wave-4 { 0%,100%{transform:scaleY(0.25)} 60%{transform:scaleY(1)} }
    @keyframes sig-wave-5 { 0%,100%{transform:scaleY(0.45)} 25%{transform:scaleY(1)} }
    @keyframes sig-wave-6 { 0%,100%{transform:scaleY(0.3)} 50%{transform:scaleY(1)} }
    @keyframes sig-wave-7 { 0%,100%{transform:scaleY(0.55)} 40%{transform:scaleY(1)} }

    .sig-wave-bar {
      width: 3px;
      border-radius: 1px;
      background: var(--accent-color);
      transform-origin: center;
      opacity: 0.9;
    }

    /* Tier 2 (40-74%): spinning arc (CSS conic) */
    @keyframes sig-arc-spin {
      0%   { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes sig-arc-pulse {
      0%, 100% { opacity: 0.7; }
      50%       { opacity: 1; }
    }

    /* Tier 3 (15-39%): morse dash blink */
    @keyframes sig-morse-long  { 0%,100%{opacity:0.15} 10%,55%{opacity:0.9} 56%,100%{opacity:0.15} }
    @keyframes sig-morse-short { 0%,100%{opacity:0.15} 65%,80%{opacity:0.9} 81%,100%{opacity:0.15} }
    @keyframes sig-morse-dot   { 0%,100%{opacity:0.15} 88%,96%{opacity:0.9} 97%,100%{opacity:0.15} }

    .sig-morse-dash {
      height: 3px;
      border-radius: 999px;
      background: rgba(255,200,80,0.85);
      transform-origin: left;
    }

    /* Tier 4 (<15%): glitching static blocks */
    @keyframes sig-static-a { 0%,100%{opacity:0.1;transform:scaleX(1)}   17%{opacity:0.8;transform:scaleX(0.6)}  33%{opacity:0.2;transform:scaleX(1.2)} }
    @keyframes sig-static-b { 0%,100%{opacity:0.05;transform:scaleX(1)}  42%{opacity:0.9;transform:scaleX(0.4)}  58%{opacity:0.1;transform:scaleX(0.9)} }
    @keyframes sig-static-c { 0%,100%{opacity:0.15;transform:scaleX(1)}  71%{opacity:0.7;transform:scaleX(1.3)}  80%{opacity:0.05} }

    .drifter-signal-value {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      justify-content: flex-end;
      min-width: 110px;
    }

    .drifter-signal-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--accent-color);
      box-shadow: 0 0 10px rgba(136, 204, 255, 0.55);
      animation: signal-pulse 1.2s ease-in-out infinite;
      flex-shrink: 0;
    }

    .drifter-signal-meter {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      height: 16px;
      min-width: 60px;
    }
      background: var(--panel-bg);
      border: 1px solid var(--border-color);
      backdrop-filter: blur(6px) saturate(1.2);
      -webkit-backdrop-filter: blur(6px) saturate(1.2);
      position: relative;
      overflow: hidden;
      transition: background 1.2s ease, border-color 1.2s ease;
    }

    .drifter-panel::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%);
      pointer-events: none;
    }

    .drifter-panel.glitching {
      animation: glitch-border 6s infinite;
    }

    .drifter-menu-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: flex-start;
      padding: 28px 32px 40px 40px;
      width: min(460px, 46vw);
      max-width: 520px;
      height: 100%;
      pointer-events: auto;
    }

    .drifter-inline-status {
      display: grid;
      gap: 10px;
      font-family: 'VT323', 'Share Tech Mono', monospace;
      font-size: 0.78rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--text-secondary);
      white-space: pre;
    }

    .drifter-inline-status-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 18px;
      align-items: center;
    }

    .drifter-menu-item {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      font-family: 'VT323', 'Share Tech Mono', monospace;
      font-size: 0.95rem;
      letter-spacing: 0.24em;
      text-transform: uppercase;
      color: var(--text-primary);
      cursor: pointer;
      background: transparent;
      border: none;
      padding: 6px 0;
      outline: none;
      position: relative;
      width: fit-content;
      min-width: 100%;
    }

    .drifter-menu-item::before {
      content: '';
      width: 10px;
      height: 10px;
      border: 1px solid transparent;
      border-radius: 2px;
      transition: border-color 0.18s ease, opacity 0.18s ease;
      opacity: 0;
      flex-shrink: 0;
    }

    .drifter-menu-item.active::before {
      opacity: 1;
      border-color: var(--accent-color);
      box-shadow: 0 0 0 1px rgba(136, 204, 255, 0.22);
      background: rgba(255, 255, 255, 0.06);
    }

    .drifter-menu-item:hover {
      color: var(--accent-color);
    }

    .drifter-tagline {
      font-family: 'VT323', 'Share Tech Mono', monospace;
      font-size: 0.75rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--text-secondary);
      max-width: 420px;
      line-height: 1.6;
    }

    .drifter-moon {
      position: absolute;
      top: 10%;
      right: 14%;
      width: 96px;
      height: 96px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(246,249,255,0.96) 0%, rgba(230,236,247,0.45) 40%, rgba(230,236,247,0.08) 62%, transparent 100%);
      filter: blur(0.4px);
      box-shadow: 0 0 32px rgba(240,248,255,0.18);
      pointer-events: none;
      opacity: 0.95;
    }

    .drifter-btn {
      display: block;
      width: 100%;
      padding: 14px 20px;
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      font-family: 'Rubik Glitch', 'Rajdhani', system-ui, sans-serif;
      font-size: 1rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-align: left;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
    }

    .drifter-btn::after {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: var(--accent-color);
      transform: scaleY(0);
      transform-origin: bottom;
      transition: transform 0.18s ease;
    }

    .drifter-btn:hover {
      background: rgba(255,255,255,0.06);
      border-color: var(--accent-color);
    }

    .drifter-btn:hover::after {
      transform: scaleY(1);
    }

    .drifter-btn:active {
      background: rgba(255,255,255,0.1);
    }

    .drifter-btn.secondary {
      opacity: 0.6;
      font-size: 0.85rem;
    }

    .drifter-btn.secondary:hover {
      opacity: 1;
    }

    .drifter-label {
      font-family: 'VT323', 'Share Tech Mono', monospace;
      font-size: 0.7rem;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--text-secondary);
    }

    .drifter-value {
      font-family: 'VT323', 'Share Tech Mono', monospace;
      font-size: 0.75rem;
      color: var(--text-primary);
    }

    .status-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 0;
      border-bottom: 1px solid rgba(255,255,255,0.04);
    }

    .status-row:last-child {
      border-bottom: none;
    }

    .wrongness-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      border: 1px solid var(--accent-color);
      color: var(--accent-color);
      font-family: 'VT323', 'Share Tech Mono', monospace;
      font-size: 0.65rem;
      letter-spacing: 0.12em;
    }

    .wrongness-badge .dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--accent-color);
      animation: signal-pulse 2s ease-in-out infinite;
    }

    .drifter-signal-value {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      justify-content: flex-end;
      min-width: 110px;
    }

    .drifter-signal-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--accent-color);
      box-shadow: 0 0 10px rgba(136, 204, 255, 0.55);
      animation: signal-pulse 1.2s ease-in-out infinite;
      flex-shrink: 0;
    }

    .bottom-bar {
      font-family: 'Share Tech Mono', monospace;
      font-size: 0.65rem;
      color: var(--text-secondary);
      letter-spacing: 0.06em;
      animation: text-flicker 8s infinite;
    }

    input[type="range"] {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 2px;
      background: rgba(255,255,255,0.12);
      outline: none;
      margin: 8px 0;
    }

    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      background: var(--accent-color);
      cursor: pointer;
    }

    input[type="range"]::-moz-range-thumb {
      width: 14px;
      height: 14px;
      background: var(--accent-color);
      border: none;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);
}

// ─── Noise canvas ─────────────────────────────────────────────────────────────

function createNoiseCanvas(opacity: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.opacity = String(opacity);
  canvas.style.imageRendering = 'pixelated';
  canvas.style.pointerEvents = 'none';
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(256, 256);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = Math.random() * 255;
    imageData.data[i] = v;
    imageData.data[i + 1] = v;
    imageData.data[i + 2] = v;
    imageData.data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// ─── DrifterAudio ─────────────────────────────────────────────────────────────
// Handles all Web Audio for Drifter's Tale:
//   • Ambient music engine (drone + texture noise + sparse melody)
//   • UI sounds (hover, select, back, deploy, error)
// Sky wrongness state drives filter cutoff, drone detune, and melody density.

class DrifterAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private volume = 0.65;

  // Ambient nodes — kept alive for the full session
  private droneOscs: OscillatorNode[] = [];
  private droneGains: GainNode[] = [];
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private noiseGain: GainNode | null = null;
  private melodyTimer: ReturnType<typeof setTimeout> | null = null;
  private ambientRunning = false;
  private currentWrongness: WrongnessState = WrongnessState.GREY;

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.setTargetAtTime(this.volume * 0.7, this.getCtx().currentTime, 0.1);
  }

  startAmbient(wrongness: WrongnessState = WrongnessState.GREY): void {
    if (this.ambientRunning) {
      this.applyWrongness(wrongness);
      return;
    }
    this.currentWrongness = wrongness;
    this.ambientRunning = true;
    this.buildAmbient();
    this.scheduleMelody();
  }

  stopAmbient(): void {
    this.ambientRunning = false;
    if (this.melodyTimer) clearTimeout(this.melodyTimer);
    const t = this.ctx?.currentTime ?? 0;
    this.droneGains.forEach(g => g.gain.setTargetAtTime(0, t, 0.8));
    this.noiseGain?.gain.setTargetAtTime(0, t, 0.8);
    setTimeout(() => {
      this.droneOscs.forEach(o => { try { o.stop(); } catch (_) {} });
      this.noiseSource?.stop();
      this.droneOscs = [];
      this.droneGains = [];
      this.noiseSource = null;
      this.noiseFilter = null;
      this.noiseGain = null;
    }, 2000);
  }

  applyWrongness(wrongness: WrongnessState): void {
    this.currentWrongness = wrongness;
    if (!this.ctx || !this.noiseFilter) return;
    const t = this.ctx.currentTime;
    const { cutoff, droneDetune, noiseVol } = this.wrongnessParams(wrongness);
    this.noiseFilter.frequency.setTargetAtTime(cutoff, t, 1.5);
    this.noiseGain?.gain.setTargetAtTime(noiseVol * this.volume * 0.18, t, 1.5);
    this.droneOscs.forEach((osc, i) => {
      osc.detune.setTargetAtTime(droneDetune + i * 3, t, 2.0);
    });
  }

  dispose(): void {
    this.stopAmbient();
    setTimeout(() => { try { this.ctx?.close(); } catch (_) {} this.ctx = null; }, 2500);
  }

  // ── UI sounds ────────────────────────────────────────────────────────────────

  /** Hover over a menu item */
  playHover(): void {
    this.uiSound((ctx, out) => {
      const f = 1200 + Math.random() * 200;
      this.staticBurst(ctx, out, f, 0.022, 0.045);
    });
  }

  /** Confirm / select */
  playSelect(): void {
    this.uiSound((ctx, out) => {
      // two-tone click: high then low
      this.tone(ctx, out, 1800, 0, 0.04, 0.04);
      this.tone(ctx, out, 900, 0.05, 0.06, 0.035);
      this.staticBurst(ctx, out, 2400, 0.02, 0.03);
    });
  }

  /** Navigate back */
  playBack(): void {
    this.uiSound((ctx, out) => {
      this.tone(ctx, out, 700, 0, 0.05, 0.04);
      this.tone(ctx, out, 400, 0.04, 0.055, 0.04);
    });
  }

  /** Deploy drifter — heavier */
  playDeploy(): void {
    this.uiSound((ctx, out) => {
      // deep thud + rising tone
      this.tone(ctx, out, 80, 0, 0.18, 0.12, 'sine', true);
      this.tone(ctx, out, 440, 0.06, 0.12, 0.08);
      this.tone(ctx, out, 880, 0.10, 0.10, 0.055);
      this.staticBurst(ctx, out, 3200, 0.08, 0.12);
    });
  }

  /** Abort / error */
  playAbort(): void {
    this.uiSound((ctx, out) => {
      this.tone(ctx, out, 320, 0, 0.06, 0.055);
      this.staticBurst(ctx, out, 800, 0.0, 0.07);
      this.tone(ctx, out, 200, 0.06, 0.08, 0.06);
    });
  }

  // ── Internal: ambient engine ─────────────────────────────────────────────────

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume * 0.7;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private wrongnessParams(w: WrongnessState): { cutoff: number; droneDetune: number; noiseVol: number; basePitch: number } {
    switch (w) {
      case WrongnessState.SUNNY:  return { cutoff: 800,  droneDetune: 0,    noiseVol: 0.4, basePitch: 60  };
      case WrongnessState.BLUE:   return { cutoff: 600,  droneDetune: -8,   noiseVol: 0.5, basePitch: 58  };
      case WrongnessState.GREY:   return { cutoff: 400,  droneDetune: -18,  noiseVol: 0.6, basePitch: 55  };
      case WrongnessState.RAINY:  return { cutoff: 300,  droneDetune: -28,  noiseVol: 0.75, basePitch: 52 };
      case WrongnessState.STATIC: return { cutoff: 200,  droneDetune: -40,  noiseVol: 0.9, basePitch: 49  };
      case WrongnessState.STORMY: return { cutoff: 160,  droneDetune: -55,  noiseVol: 1.0, basePitch: 46  };
      default:                    return { cutoff: 350,  droneDetune: -22,  noiseVol: 0.65, basePitch: 54 };
    }
  }

  private buildAmbient(): void {
    const ctx = this.getCtx();
    const out = this.master!;
    const { cutoff, droneDetune, noiseVol, basePitch } = this.wrongnessParams(this.currentWrongness);

    // ── Drone: 3 detuned sawtooth oscillators with slow LFO swell ──────────────
    const droneFreqs = [basePitch, basePitch + 7, basePitch + 12].map(midi => 440 * Math.pow(2, (midi - 69) / 12));
    droneFreqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sawtooth' : 'sine';
      osc.frequency.value = freq;
      osc.detune.value = droneDetune + i * 3;

      // LFO on gain — slow swell, staggered
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07 + i * 0.03;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.06;
      lfo.connect(lfoGain);

      const g = ctx.createGain();
      g.gain.value = 0;
      lfoGain.connect(g.gain);

      // Low-pass to keep it dark
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 180 + i * 40;
      filt.Q.value = 0.6;

      osc.connect(filt);
      filt.connect(g);
      g.connect(out);

      osc.start();
      lfo.start();

      // Fade in staggered
      g.gain.setTargetAtTime(0.055 - i * 0.012, ctx.currentTime + i * 1.2, 2.5);

      this.droneOscs.push(osc);
      this.droneGains.push(g);
    });

    // ── Noise: white noise through a bandpass filter, breathing ────────────────
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const noiseF = ctx.createBiquadFilter();
    noiseF.type = 'bandpass';
    noiseF.frequency.value = cutoff;
    noiseF.Q.value = 1.4;

    const noiseG = ctx.createGain();
    noiseG.gain.value = noiseVol * this.volume * 0.18;

    noise.connect(noiseF);
    noiseF.connect(noiseG);
    noiseG.connect(out);
    noise.start();

    this.noiseSource = noise;
    this.noiseFilter = noiseF;
    this.noiseGain = noiseG;
  }

  private scheduleMelody(): void {
    if (!this.ambientRunning) return;

    const { basePitch } = this.wrongnessParams(this.currentWrongness);

    // Minor pentatonic scale (MIDI offsets from root)
    const PENTA_MINOR = [0, 3, 5, 7, 10, 12, 15, 17];

    const playNote = () => {
      if (!this.ambientRunning) return;
      const ctx = this.getCtx();
      const out = this.master!;

      const note = basePitch + PENTA_MINOR[Math.floor(Math.random() * PENTA_MINOR.length)]
        + (Math.random() < 0.3 ? 12 : 0); // occasional octave jump
      const freq = 440 * Math.pow(2, (note - 69) / 12);

      // Triangle wave — soft, bell-like
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      const g = ctx.createGain();
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(this.volume * 0.055, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);

      osc.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + 2.5);

      // Next note: long gap, varies with wrongness severity
      const baseGap = this.wrongnessGap();
      const gap = baseGap + Math.random() * baseGap * 0.8;
      this.melodyTimer = setTimeout(playNote, gap * 1000);
    };

    // Initial delay before first note
    const initDelay = 3 + Math.random() * 5;
    this.melodyTimer = setTimeout(playNote, initDelay * 1000);
  }

  private wrongnessGap(): number {
    // How many seconds between melody notes — higher wrongness = longer gaps, more silence
    switch (this.currentWrongness) {
      case WrongnessState.SUNNY:  return 5;
      case WrongnessState.BLUE:   return 7;
      case WrongnessState.GREY:   return 9;
      case WrongnessState.RAINY:  return 12;
      case WrongnessState.STATIC: return 18;
      case WrongnessState.STORMY: return 26;
      default:                    return 10;
    }
  }

  // ── Internal: UI sound primitives ────────────────────────────────────────────

  private uiSound(build: (ctx: AudioContext, out: GainNode) => void): void {
    try {
      const ctx = this.getCtx();
      if (ctx.state === 'suspended') ctx.resume();
      const uiGain = ctx.createGain();
      uiGain.gain.value = this.volume * 0.55;
      uiGain.connect(ctx.destination);
      build(ctx, uiGain);
    } catch (_) {}
  }

  private tone(
    ctx: AudioContext, out: GainNode,
    freq: number, startOffset: number, duration: number, decay: number,
    type: OscillatorType = 'square', pitchDrop = false,
  ): void {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    if (pitchDrop) osc.frequency.exponentialRampToValueAtTime(freq * 0.2, ctx.currentTime + startOffset + duration);

    const g = ctx.createGain();
    const t = ctx.currentTime + startOffset;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.9, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration + decay);

    osc.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + duration + decay + 0.05);
  }

  private staticBurst(
    ctx: AudioContext, out: GainNode,
    filterFreq: number, startOffset: number, duration: number,
  ): void {
    const bufSize = Math.ceil(ctx.sampleRate * (duration + 0.02));
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = filterFreq;
    filt.Q.value = 2;

    const g = ctx.createGain();
    const t = ctx.currentTime + startOffset;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.7, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    src.connect(filt);
    filt.connect(g);
    g.connect(out);
    src.start(t);
  }
}

// ─── HomeScreen class ─────────────────────────────────────────────────────────

export class HomeScreen {
  private root: HTMLElement;
  private mode: AppMode = 'menu';
  private settings: GameSettings = loadSettings();
  private engine: GameplayEngine | null = null;
  private currentZone: Zone | null = null;
  private backgroundFolder: MenuBackgroundFolder;
  private statusMessage = 'Relay node connection established. Standing by.';
  private menuIndex = 0;
  private gameRuntime: GameRuntime | null = null;
  private menuDateInitialized = false;
  private menuDateValue: Date | null = null;
  private audio = new DrifterAudio();

  private wrongnessState: WrongnessState = WrongnessState.GREY;

  constructor(rootId = 'app') {
    const root = document.getElementById(rootId);
    if (!root) throw new Error(`HomeScreen: no element with id '${rootId}'`);
    this.root = root;
    this.backgroundFolder = this.pickBackground();
    injectGlobalStyles();
    this.applyThemeVars();
    this.audio.setVolume(this.settings.volume);
    // AudioContext requires user gesture — start on first click/touch
    const startAudio = () => {
      this.audio.startAmbient(this.wrongnessState);
      window.removeEventListener('click', startAudio);
      window.removeEventListener('keydown', startAudio);
      window.removeEventListener('touchstart', startAudio);
    };
    window.addEventListener('click', startAudio, { once: true });
    window.addEventListener('keydown', startAudio, { once: true });
    window.addEventListener('touchstart', startAudio, { once: true });
    this.render();
  }

  public async launchStory(): Promise<void> {
    await this.startRun('story');
  }

  public async launchExploration(): Promise<void> {
    await this.startRun('exploration');
  }

  public showSettings(): void {
    this.setMode('settings');
  }

  public showMenu(): void {
    this.disposePlaySession();
    this.mode = 'menu';
    this.currentZone = null;
    this.engine = null;
    this.statusMessage = 'Relay node connection established. Standing by.';
    this.backgroundFolder = this.pickBackground();
    this.render();

    // If the legacy static menu panel exists (menu.html), show it and hide the app container.
    try {
      const panel = document.getElementById('panel');
      const appEl = document.getElementById('app');
      if (panel) panel.style.display = 'block';
      if (appEl) appEl.style.display = 'none';
    } catch (e) {
      // ignore if DOM differs in other contexts
    }
  }

  public run(): void {
    this.render();
  }

  // ── CSS custom properties on :root so all sub-elements inherit ──────────────
  private applyThemeVars(): void {
    const p = WRONGNESS_PALETTE[this.wrongnessState];
    const r = document.documentElement;
    r.style.setProperty('--panel-bg', p.panelBg);
    r.style.setProperty('--border-color', p.borderColor);
    r.style.setProperty('--accent-color', p.accentColor);
    r.style.setProperty('--text-primary', p.textPrimary);
    r.style.setProperty('--text-secondary', p.textSecondary);

    // scanlines
    const scanlines = document.getElementById('drifter-scanlines');
    if (scanlines) scanlines.style.opacity = String(p.scanlineOpacity);
  }

  // ── Full render ──────────────────────────────────────────────────────────────
  private render(): void {
    this.applyThemeVars();
    this.root.innerHTML = '';

    const mode = this.mode;
    const p = WRONGNESS_PALETTE[this.wrongnessState];

    const shouldShowAtmosphere = mode !== 'play';

    // ── Scanlines (screen-space, fixed, behind everything else) ─────────────
    if (shouldShowAtmosphere) {
      const scanlines = el('div');
      scanlines.id = 'drifter-scanlines';
      scanlines.style.opacity = String(p.scanlineOpacity);
      this.root.appendChild(scanlines);
    }

    // ── Noise (fixed behind scanlines) ──────────────────────────────────────
    if (shouldShowAtmosphere) {
      const noiseWrap = el('div');
      noiseWrap.id = 'drifter-noise';
      noiseWrap.style.opacity = String(p.noiseOpacity);
      if (p.noiseOpacity > 0) {
        noiseWrap.appendChild(createNoiseCanvas(1));
        // Animate noise refresh
        setInterval(() => {
          noiseWrap.innerHTML = '';
          noiseWrap.appendChild(createNoiseCanvas(1));
        }, 120);
      }
      this.root.appendChild(noiseWrap);
    }

    // ── Background ───────────────────────────────────────────────────────────
    const backgroundLayer = this.renderBackground(p.skyFilter);
    if (mode === 'play') {
      backgroundLayer.style.opacity = '0.3';
    }
    this.root.appendChild(backgroundLayer);

    // ── Full-bleed split layout ──────────────────────────────────────────────
    const layout = el('div', {
      position: 'absolute',
      inset: '0',
      zIndex: '10',
      pointerEvents: 'none',
    });

    switch (mode) {
      case 'menu': {
        const overlay = el('div');
        overlay.className = 'drifter-menu-overlay';
        overlay.appendChild(this.renderTitle());

        const bottomBlock = el('div');
        Object.assign(bottomBlock.style, {
          display: 'flex',
          flexDirection: 'column',
          gap: '22px',
          width: '100%',
        });
        bottomBlock.appendChild(this.renderStationStatusInline());
        bottomBlock.appendChild(this.renderMenuNav());
        bottomBlock.appendChild(this.renderTagline());

        overlay.appendChild(bottomBlock);
        layout.appendChild(overlay);
        break;
      }
      case 'play': {
        const playSurface = el('div', {
          position: 'absolute',
          inset: '0',
          zIndex: '2',
          pointerEvents: 'none',
        });

        const canvasWrap = el('div', {
          position: 'absolute',
          inset: '0',
          zIndex: '0',
          pointerEvents: 'none',
          background: 'radial-gradient(circle at center, rgba(4,10,18,0.18) 0%, rgba(2,4,8,0.88) 70%, rgba(1,2,4,1) 100%)',
        });
        if (this.gameRuntime) {
          const canvas = this.gameRuntime.canvas;
          canvas.style.width = '100%';
          canvas.style.height = '100%';
          canvas.style.display = 'block';
          canvas.style.objectFit = 'cover';
          canvas.style.pointerEvents = 'none';
          canvas.style.filter = 'contrast(1.04) saturate(1.05)';
          canvasWrap.appendChild(canvas);
          this.gameRuntime.handleResize();
        }
        playSurface.appendChild(canvasWrap);

        const hud = el('div', {
          position: 'absolute',
          left: '24px',
          top: '24px',
          right: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px',
          zIndex: '3',
          pointerEvents: 'none',
        });

        const missionPanel = el('div', {
          maxWidth: '420px',
          padding: '14px 16px',
          background: 'rgba(4, 8, 15, 0.64)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(8px)',
        });
        // Portrait variant derives from the drifter's seed so the same survivor
        // always shows the same face (WNCORE portrait packs on disk).
        const portraitSeed = this.engine ? Math.abs(Math.round(Number(this.engine.drifter.drifterSeed) || 1)) : 1;
        const portraitVariant = (portraitSeed % 3) + 1;
        const portraitPath = `/assets/characters/drifter/portraits/drifter/swat_${portraitVariant}/calm.png`;
        const controlsHint = this.settings.showHints
          ? `<div style="font-family:'Share Tech Mono',monospace;font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-secondary);margin-top:4px;">WASD · MOVE &nbsp; E · EXTRACT &nbsp; M · SURVEY MAP &nbsp; ESC · RELAY</div>`
          : '';
        missionPanel.innerHTML = `
          <div style="display:flex;gap:12px;align-items:flex-start;">
            <img src="${portraitPath}" alt="" onerror="this.style.display='none'" style="width:56px;height:56px;object-fit:cover;object-position:top;image-rendering:pixelated;border:1px solid rgba(255,255,255,0.18);background:#0a0f16;flex-shrink:0;" />
            <div>
              <div style="font-family:'Share Tech Mono',monospace;font-size:0.64rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--text-secondary);margin-bottom:6px;">RUN STATUS · ${this.engine?.drifter.name ?? 'DRIFTER'}</div>
              <div style="font-family:'Rajdhani',system-ui,sans-serif;font-size:1rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-primary);margin-bottom:4px;">${this.currentZone?.name ?? 'RELAY ZONE'}</div>
              <div style="font-family:'Share Tech Mono',monospace;font-size:0.72rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--text-secondary);">${this.engine ? Math.round(this.engine.drifter.signalStrength) : 0}% SIGNAL</div>
              ${controlsHint}
            </div>
          </div>
        `;
        hud.appendChild(missionPanel);

        const controlsPanel = el('div', {
          padding: '14px 16px',
          background: 'rgba(4, 8, 15, 0.64)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(8px)',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '0.68rem',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          lineHeight: '1.8',
          minWidth: '200px',
        });
        const skyState = String(this.currentZone?.wrongnessState ?? 'UNKNOWN').replace(/_/g, ' ');
        const zoneName = this.currentZone?.name ?? 'UNKNOWN ZONE';
        const zoneType = String(this.currentZone?.type ?? '').replace(/_/g, ' ');
        const huskCount = this.engine?.huskSystem?.getAllHusks().length ?? 0;
        controlsPanel.innerHTML = `
          <div style="color:rgba(84,230,164,0.7);margin-bottom:4px;font-size:0.58rem;letter-spacing:0.22em;">WNCORE RELAY · LIVE UPLINK</div>
          <div>SKY &nbsp;<span style="color:var(--text-primary)">${skyState}</span></div>
          <div>ZONE &nbsp;<span style="color:var(--text-primary)">${zoneName}</span></div>
          <div>TYPE &nbsp;<span style="color:var(--text-primary)">${zoneType}</span></div>
          <div>THREATS TRACKED &nbsp;<span style="color:${huskCount > 3 ? '#ff7a6a' : 'var(--text-primary)'}">${huskCount}</span></div>
        `;
        hud.appendChild(controlsPanel);

        // Field-sketch minimap (bottom-right) + world survey overlay (M key).
        if (this.gameRuntime) {
          const minimapWrap = el('div', {
            position: 'absolute',
            right: '24px',
            bottom: '24px',
            zIndex: '3',
            pointerEvents: 'none',
            padding: '8px',
            background: 'rgba(4, 8, 15, 0.64)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(8px)',
          });
          const minimapLabel = el('div', {
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '0.55rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
            marginBottom: '5px',
            textAlign: 'center',
          });
          minimapLabel.textContent = 'FIELD SKETCH';
          minimapWrap.appendChild(minimapLabel);
          minimapWrap.appendChild(this.gameRuntime.minimapCanvas);
          playSurface.appendChild(minimapWrap);

          playSurface.appendChild(this.gameRuntime.worldMapCanvas);

          // WNCORE ambient broadcast feed (bottom-left).
          playSurface.appendChild(this.gameRuntime.broadcastElement);

          // In-run atmosphere — vignette, faint scanlines, static grain.
          const playVignette = el('div', {
            position: 'absolute',
            inset: '0',
            zIndex: '1',
            pointerEvents: 'none',
            background: 'radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,0.42) 100%)',
          });
          playSurface.appendChild(playVignette);

          const playScanlines = el('div', {
            position: 'absolute',
            inset: '0',
            zIndex: '1',
            pointerEvents: 'none',
            background: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 4px)',
            mixBlendMode: 'multiply',
          });
          playSurface.appendChild(playScanlines);

          const playGrain = createNoiseCanvas(0.04);
          playGrain.style.zIndex = '1';
          playSurface.appendChild(playGrain);
        }

        const backButton = el('button', {
          padding: '10px 14px',
          background: 'rgba(4, 8, 15, 0.86)',
          border: '1px solid rgba(255,255,255,0.18)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '0.68rem',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          backdropFilter: 'blur(8px)',
        });
        backButton.textContent = '← MAIN MENU';
        backButton.onclick = () => { this.audio.playBack(); this.showMenu(); };

        playSurface.appendChild(hud);
        layout.appendChild(playSurface);
        break;
      }
      case 'story':
      case 'exploration':
      case 'settings': {
        // Left pane — title + flavor text, mostly transparent
        const leftPane = el('div', {
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '0 0 40px 48px',
          pointerEvents: 'none',
        });
        leftPane.appendChild(this.renderTitle());
        layout.appendChild(leftPane);

        // Right pane — UI panels
        const rightPane = el('div', {
          width: 'clamp(320px, 38vw, 480px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '12px',
          padding: '32px 40px 32px 20px',
          pointerEvents: 'auto',
        });

        // Wrongness indicator (top of right pane)
        rightPane.appendChild(this.renderWrongnessIndicator());

        if (mode === 'story') {
          rightPane.appendChild(this.renderStoryPanel());
        } else if (mode === 'exploration') {
          rightPane.appendChild(this.renderExplorationPanel());
        } else if (mode === 'settings') {
          rightPane.appendChild(this.renderSettingsPanel());
        }

        // Bottom status bar
        rightPane.appendChild(this.renderStatusBar());
        layout.appendChild(rightPane);
        break;
      }
      case 'loading': {
        layout.appendChild(this.renderLoadingScreen());
        break;
      }
      case 'briefing': {
        layout.appendChild(this.renderBriefingScreen());
        break;
      }
      default:
        break;
    }

    this.root.appendChild(layout);
  }

  // ── Loading screen ───────────────────────────────────────────────────────────
  private renderLoadingScreen(): HTMLElement {
    const wrap = el('div', {
      position: 'absolute',
      inset: '0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '18px',
      background: 'rgba(2,4,8,0.97)',
      zIndex: '10',
    });

    const label = el('div', {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '0.65rem',
      letterSpacing: '0.28em',
      textTransform: 'uppercase',
      color: 'rgba(84,230,164,0.7)',
    });
    label.textContent = 'WNCORE · ZONE INITIALISATION';

    const bar = el('div', {
      width: '220px',
      height: '2px',
      background: 'rgba(255,255,255,0.08)',
      position: 'relative',
      overflow: 'hidden',
    });
    const fill = el('div', {
      position: 'absolute',
      top: '0',
      left: '-60%',
      width: '60%',
      height: '100%',
      background: 'rgba(84,230,164,0.7)',
      animation: 'drifter-scan 1.1s linear infinite',
    });
    bar.appendChild(fill);

    const sub = el('div', {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '0.58rem',
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: 'rgba(160,180,200,0.45)',
    });
    sub.textContent = 'generating zone · spawning threats · tuning signal';

    // Inject keyframe if not already present
    if (!document.getElementById('drifter-scan-kf')) {
      const style = document.createElement('style');
      style.id = 'drifter-scan-kf';
      style.textContent = `@keyframes drifter-scan { 0%{left:-60%} 100%{left:110%} }`;
      document.head.appendChild(style);
    }

    wrap.appendChild(label);
    wrap.appendChild(bar);
    wrap.appendChild(sub);
    return wrap;
  }

  // ── Pre-run briefing screen ──────────────────────────────────────────────────
  private renderBriefingScreen(): HTMLElement {
    const zone = this.currentZone;
    const drifter = this.engine?.drifter;
    const mode = this.pendingMode;

    const BRIEFING_LINES: Record<string, string[]> = {
      RAINY: [
        'Black rain is active in the area. Infected movement slows beneath it. Yours does not.',
        'Visibility is reduced. Husks that cannot see you can still hear you.',
      ],
      GREY: [
        'Overcast sky. No moon tonight. The shadows are clean, which means nothing is hiding in them yet.',
        'Move steady. The grey is early-stage. Do not mistake quiet for safe.',
      ],
      STATIC: [
        'Signal interference detected across the zone. Your relay feed will cut at intervals.',
        'Static state. Husk clusters have been observed standing motionless in open ground under these conditions. Do not approach.',
      ],
      STORMY: [
        'Storm conditions. Loud. Good cover for movement but the Whites use sound differently — they feel pressure, not just vibration.',
        'Do not shelter under signal towers. The current draws them.',
      ],
      SUNNY: [
        'Anomalous clear sky. The early collapse zones logged these as normal days. They were not.',
        'Full visibility is a liability as much as an asset. They can see you from the same distance you see them.',
      ],
      BLUE: [
        'Blue-sky wrongness. Low-grade. Atmosphere has shifted in the upper bands but ground level is still navigable.',
        'Trust the field sketch. Do not trust your eyes on anything that is not moving.',
      ],
      UNKNOWN: [
        'Sky state unclassified. The zone generation is reading anomalous. Proceed with elevated caution.',
        'We do not know what is out there. The logbook will tell us after.',
      ],
    };

    const skyKey = String(zone?.wrongnessState ?? 'UNKNOWN').replace('_', ' ');
    const briefingLines = BRIEFING_LINES[String(zone?.wrongnessState ?? 'UNKNOWN')] ?? BRIEFING_LINES['UNKNOWN'];
    const huskCount = this.engine?.huskSystem?.getAllHusks().length ?? 0;
    const zoneName = zone?.name ?? 'UNKNOWN ZONE';
    const zoneType = String(zone?.type ?? '').replace(/_/g, ' ');
    const drifterName = drifter?.name ?? 'DRIFTER';
    const signal = drifter ? Math.round(drifter.signalStrength) : 72;

    const wrap = el('div', {
      position: 'absolute',
      inset: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(2,4,8,0.96)',
      zIndex: '10',
    });

    const card = el('div', {
      maxWidth: '540px',
      width: '90%',
      padding: '32px 36px',
      background: 'rgba(6,12,22,0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    });

    // Header
    const header = el('div');
    const eyebrow = el('div', {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '0.58rem',
      letterSpacing: '0.28em',
      textTransform: 'uppercase',
      color: 'rgba(84,230,164,0.65)',
      marginBottom: '8px',
    });
    eyebrow.textContent = `WNCORE · ${mode === 'story' ? 'STRUCTURED RUN' : 'OPEN RUN'} · PRE-DEPLOYMENT BRIEF`;
    const drifterLabel = el('div', {
      fontFamily: "'Rajdhani', system-ui, sans-serif",
      fontSize: '1.4rem',
      fontWeight: '700',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'rgba(220,235,248,0.95)',
    });
    drifterLabel.textContent = drifterName;
    header.appendChild(eyebrow);
    header.appendChild(drifterLabel);
    card.appendChild(header);

    // Zone stats grid
    const grid = el('div', {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '8px 24px',
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '0.66rem',
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
    });
    const statRows: [string, string, boolean][] = [
      ['ZONE', zoneName, false],
      ['TYPE', zoneType, false],
      ['SKY', skyKey, true],
      ['SIGNAL', `${signal}%`, false],
      ['THREATS', String(huskCount), huskCount > 3],
    ];
    for (const [label, value, warn] of statRows) {
      const lbl = el('span', { color: 'rgba(140,165,190,0.6)' });
      lbl.textContent = label;
      const val = el('span', { color: warn ? '#ff7a6a' : 'rgba(220,235,248,0.9)' });
      val.textContent = value;
      grid.appendChild(lbl);
      grid.appendChild(val);
    }
    card.appendChild(grid);

    // Divider
    const divider = el('div', {
      height: '1px',
      background: 'rgba(255,255,255,0.07)',
    });
    card.appendChild(divider);

    // Situation report lines
    const sitrep = el('div', {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    });
    const sitrepLabel = el('div', {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '0.56rem',
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
      color: 'rgba(84,230,164,0.5)',
      marginBottom: '2px',
    });
    sitrepLabel.textContent = 'FIELD INTEL';
    sitrep.appendChild(sitrepLabel);
    for (const line of briefingLines) {
      const lineEl = el('div', {
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '0.72rem',
        lineHeight: '1.65',
        color: 'rgba(180,200,218,0.75)',
        letterSpacing: '0.06em',
      });
      lineEl.textContent = `> ${line}`;
      sitrep.appendChild(lineEl);
    }
    card.appendChild(sitrep);

    // Controls hint
    const controls = el('div', {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '0.58rem',
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'rgba(120,145,170,0.5)',
    });
    controls.textContent = 'WASD / D-PAD · MOVE   E / EXTRACT BTN · EXTRACT   M / MAP BTN · SURVEY   ESC · ABORT';
    card.appendChild(controls);

    // Deploy button
    const deployBtn = el('button', {
      padding: '13px 20px',
      background: 'rgba(84,230,164,0.12)',
      border: '1px solid rgba(84,230,164,0.5)',
      color: 'rgba(84,230,164,0.95)',
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '0.72rem',
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
      cursor: 'pointer',
      width: '100%',
    });
    deployBtn.textContent = 'CONFIRM · ENTER ZONE';
    deployBtn.onclick = () => { this.audio.playDeploy(); this.launchFromBriefing(); };
    card.appendChild(deployBtn);

    const abortBtn = el('button', {
      padding: '8px 20px',
      background: 'transparent',
      border: '1px solid rgba(255,255,255,0.1)',
      color: 'rgba(140,165,190,0.5)',
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '0.62rem',
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      cursor: 'pointer',
      width: '100%',
    });
    abortBtn.textContent = 'ABORT · RETURN TO RELAY';
    abortBtn.onclick = () => { this.audio.playAbort(); this.setMode('menu'); };
    card.appendChild(abortBtn);

    wrap.appendChild(card);
    return wrap;
  }

  // ── Background: full-bleed, layered, parallax-ish ───────────────────────────
  private renderBackground(skyFilter: string): HTMLElement {
    const bg = el('div', {
      position: 'absolute',
      inset: '0',
      zIndex: '0',
      overflow: 'hidden',
      pointerEvents: 'none',
    });

    // Base (orig.png) — darkened to let the UI breathe
    const base = el('div', {
      position: 'absolute',
      inset: '0',
      backgroundImage: "url('/assets/wncorelastbastion.png')",
      backgroundSize: 'cover',
      backgroundPosition: 'center bottom',
      filter: 'brightness(0.92)',
    });
    bg.appendChild(base);

    // Parallax layers (screen composited)
    const blendModes: GlobalCompositeOperation[] = ['screen', 'screen', 'overlay', 'multiply'];
    const layerOpacities = [0.12, 0.1, 0.08, 0.06];
    const folder = this.backgroundFolder;
    const layerCount = 0;

    for (let i = 0; i < layerCount; i++) {
      const img = el('img', {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        opacity: String(layerOpacities[i] ?? 0.06),
        mixBlendMode: blendModes[i] ?? 'screen',
        pointerEvents: 'none',
      });
      img.src = this.bgPath(`${i + 1}.png`);
      bg.appendChild(img);
    }

    const moon = el('div');
    moon.className = 'drifter-moon';
    bg.appendChild(moon);

    // Bottom vignette — grounds the title
    const vignetteBottom = el('div', {
      position: 'absolute',
      inset: '0',
      background: 'linear-gradient(to top, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.0) 48%)',
      pointerEvents: 'none',
    });
    bg.appendChild(vignetteBottom);

    return bg;
  }

  private async createPlaySession(): Promise<void> {
    this.disposePlaySession();
    if (!this.engine || !this.currentZone) return;
    this.gameRuntime = new GameRuntime(this.engine, this.currentZone);
    this.gameRuntime.onRunComplete = () => {
      this.engine?.completeRun();
      this.showRunComplete();
    };
    await this.gameRuntime.start();
  }

  /** Extraction success — brief diegetic summary, then back to the relay. */
  private showRunComplete(): void {
    const overlay = el('div', {
      position: 'fixed',
      inset: '0',
      zIndex: '90',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '12px',
      background: 'rgba(2,4,8,0.9)',
      backdropFilter: 'blur(4px)',
    });
    const title = el('div', {
      fontFamily: "'Rubik Glitch', 'Rajdhani', system-ui, sans-serif",
      fontSize: '2.2rem',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'var(--accent-color)',
      textShadow: '0 0 30px rgba(84,230,164,0.3)',
    });
    title.textContent = 'SIGNAL SECURED';
    const drifterName = this.engine?.drifter.name ?? 'DRIFTER';
    const zoneName = this.currentZone?.name ?? 'UNKNOWN ZONE';
    const signal = this.engine ? Math.round(this.engine.drifter.signalStrength) : 0;

    const LOGBOOK_LINES = [
      'Made it out. The signal held.',
      'Zone logged. Left nothing behind.',
      'Extraction clean. Relay archived.',
      'The quiet held long enough.',
      'Another run. Another page in the logbook.',
    ];
    const logLine = LOGBOOK_LINES[Math.floor(Math.random() * LOGBOOK_LINES.length)];

    const sub = el('div', {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '0.72rem',
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: 'var(--text-secondary)',
      textAlign: 'center',
      lineHeight: '1.8',
    });
    sub.innerHTML = `DRIFTER EXTRACTED · ${drifterName}<br>ZONE: ${zoneName} · SIGNAL AT EXTRACT: ${signal}%<br><br><span style="color:rgba(160,180,200,0.5);font-size:0.65rem;letter-spacing:0.1em;text-transform:none;">"${logLine}"</span>`;
    overlay.appendChild(title);
    overlay.appendChild(sub);
    document.body.appendChild(overlay);
    window.setTimeout(() => {
      overlay.remove();
      this.showMenu();
    }, 3800);
  }

  private disposePlaySession(): void {
    if (!this.gameRuntime) return;
    this.gameRuntime.stop();
    this.gameRuntime = null;
  }

  // No direct input handling in HomeScreen; GameRuntime owns gameplay input.

  // ── Title (left pane, bottom-anchored) ──────────────────────────────────────
  private renderTitle(): HTMLElement {
    const wrap = el('div');

    const eyebrow = el('div', {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '0.65rem',
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
      color: 'var(--text-secondary)',
      marginBottom: '10px',
    });
    eyebrow.textContent = 'WNCORE · RELAY STATION 7 · DHAKA';
    wrap.appendChild(eyebrow);

    const title = el('h1', {
      margin: '0 0 8px',
      fontFamily: "'Rubik Glitch', 'Rajdhani', system-ui, sans-serif",
      fontSize: 'clamp(2.8rem, 5.5vw, 4.2rem)',
      fontWeight: '700',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      lineHeight: '0.95',
      color: 'var(--text-primary)',
      textShadow: '0 2px 40px rgba(0,0,0,0.9)',
    });
    title.innerHTML = 'DRIFTER\'S<br>TALE';
    wrap.appendChild(title);

    return wrap;
  }

  // ── Wrongness indicator (top-right, small) ───────────────────────────────────
  private renderWrongnessIndicator(): HTMLElement {
    const p = WRONGNESS_PALETTE[this.wrongnessState];
    const wrap = el('div', {
      display: 'flex',
      justifyContent: 'flex-end',
      marginBottom: '4px',
    });
    const badge = el('div');
    badge.className = 'wrongness-badge';
    badge.innerHTML = `<span class="dot"></span>${p.label}`;
    wrap.appendChild(badge);
    return wrap;
  }

  private renderSignalMeter(percent: number): HTMLElement {
    const wrap = el('span');
    wrap.className = 'drifter-signal-value';

    // Dot — colour shifts by tier
    const dot = el('span');
    dot.className = 'drifter-signal-dot';
    if (percent < 15) {
      dot.style.background = '#ff4a3a';
      dot.style.boxShadow = '0 0 10px rgba(255,74,58,0.6)';
    } else if (percent < 40) {
      dot.style.background = 'rgba(255,200,80,0.9)';
      dot.style.boxShadow = '0 0 10px rgba(255,200,80,0.5)';
    }
    wrap.appendChild(dot);

    const meter = el('span');
    meter.className = 'drifter-signal-meter';

    if (percent >= 75) {
      // ── Tier 1: waveform ────────────────────────────────────────────────────
      // 8 vertical bars, staggered sine-like animations
      const BAR_COUNT = 8;
      const heights = [7, 11, 14, 10, 13, 8, 12, 9]; // px
      meter.style.alignItems = 'center';
      meter.style.gap = '2px';
      for (let i = 0; i < BAR_COUNT; i++) {
        const bar = el('span');
        bar.className = 'sig-wave-bar';
        bar.style.height = `${heights[i]}px`;
        bar.style.animation = `sig-wave-${i} ${0.55 + (i % 4) * 0.08}s ease-in-out infinite`;
        bar.style.animationDelay = `${i * 0.065}s`;
        meter.appendChild(bar);
      }

    } else if (percent >= 40) {
      // ── Tier 2: spinning conic arc ──────────────────────────────────────────
      const size = 18;
      const arcPercent = Math.round((percent / 100) * 85 + 5); // 5–90 degrees visible
      const arc = el('span');
      Object.assign(arc.style, {
        display: 'inline-block',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: `conic-gradient(var(--accent-color) ${arcPercent}%, rgba(255,255,255,0.08) ${arcPercent}%)`,
        animation: 'sig-arc-spin 2.4s linear infinite, sig-arc-pulse 1.6s ease-in-out infinite',
        boxShadow: '0 0 8px rgba(84,230,164,0.25)',
        flexShrink: '0',
      });
      meter.appendChild(arc);

      // small tick marks around the outside — static, drawn as a ring
      const ring = el('span');
      Object.assign(ring.style, {
        display: 'inline-block',
        width: `${size + 6}px`,
        height: `${size + 6}px`,
        borderRadius: '50%',
        border: '1px dashed rgba(84,230,164,0.2)',
        position: 'absolute',
        pointerEvents: 'none',
      });
      // wrap arc + ring in a relative container
      const arcWrap = el('span');
      Object.assign(arcWrap.style, {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${size + 6}px`,
        height: `${size + 6}px`,
        flexShrink: '0',
      });
      arcWrap.appendChild(ring);
      arcWrap.appendChild(arc);
      meter.appendChild(arcWrap);

    } else if (percent >= 15) {
      // ── Tier 3: morse-code dashes ───────────────────────────────────────────
      // Pattern: — — · (long long dot), all blink on staggered timing
      const DURATION = '1.8s';
      const dashes: [string, number, string][] = [
        ['sig-morse-long',  28, DURATION],
        ['sig-morse-short', 18, DURATION],
        ['sig-morse-dot',    6, DURATION],
      ];
      meter.style.gap = '4px';
      meter.style.alignItems = 'center';
      for (const [anim, width, dur] of dashes) {
        const dash = el('span');
        dash.className = 'sig-morse-dash';
        dash.style.width = `${width}px`;
        dash.style.animation = `${anim} ${dur} ease-in-out infinite`;
        meter.appendChild(dash);
      }

    } else {
      // ── Tier 4: broken static blocks ────────────────────────────────────────
      const BLOCK_COUNT = 5;
      const anims = ['sig-static-a', 'sig-static-b', 'sig-static-c', 'sig-static-b', 'sig-static-a'];
      const widths = [10, 7, 14, 6, 9];
      meter.style.gap = '2px';
      meter.style.alignItems = 'center';
      for (let i = 0; i < BLOCK_COUNT; i++) {
        const block = el('span');
        Object.assign(block.style, {
          display: 'inline-block',
          width: `${widths[i]}px`,
          height: '6px',
          borderRadius: '1px',
          background: i % 2 === 0 ? '#ff4a3a' : 'rgba(255,74,58,0.4)',
          animation: `${anims[i]} ${0.28 + i * 0.07}s steps(1) infinite`,
          animationDelay: `${i * 0.04}s`,
        });
        meter.appendChild(block);
      }
    }

    wrap.appendChild(meter);

    const valueText = el('span');
    Object.assign(valueText.style, {
      color: percent < 15 ? '#ff4a3a' : percent < 40 ? 'rgba(255,200,80,0.9)' : 'var(--text-primary)',
      marginLeft: '6px',
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '0.68rem',
      letterSpacing: '0.1em',
    });
    valueText.textContent = `${percent}%`;
    wrap.appendChild(valueText);

    return wrap;
  }

  // ── Station status inline text for menu — left-anchored, raw mono ─────────────
  private renderStationStatusInline(): HTMLElement {
    const now = this.getMenuDateTime();
    const signalPercent = this.engine
      ? Math.max(8, Math.min(99, Math.round(this.engine.drifter.signalStrength)))
      : 72;
    const statusLines: [string, HTMLElement][] = [
      ['SIGNAL STRENGTH', this.renderSignalMeter(signalPercent)],
      ['STATION ID', (() => {
        const elNode = el('span');
        elNode.textContent = 'R-23';
        Object.assign(elNode.style, { color: 'var(--text-primary)' });
        return elNode;
      })()],
      ['DATE', (() => {
        const elNode = el('span');
        elNode.textContent = now.date;
        Object.assign(elNode.style, { color: 'var(--text-primary)' });
        return elNode;
      })()],
      ['TIME', (() => {
        const elNode = el('span');
        elNode.textContent = now.time;
        Object.assign(elNode.style, { color: 'var(--text-primary)' });
        return elNode;
      })()],
    ];

    const wrap = el('div');
    wrap.className = 'drifter-inline-status';

    for (const [label, valueNode] of statusLines) {
      const row = el('div');
      row.className = 'drifter-inline-status-row';
      const labelEl = el('span');
      labelEl.textContent = label;
      row.appendChild(labelEl);
      row.appendChild(valueNode);
      wrap.appendChild(row);
    }

    return wrap;
  }

  private getMenuDateTime(): { date: string; time: string } {
    const storageKey = 'drifter-menu-current-date-v4';
    const start = new Date(2032, 1, 7, 0, 0, 0);

    if (!this.menuDateInitialized) {
      sessionStorage.removeItem('drifter-menu-current-date-v2');
      sessionStorage.removeItem('drifter-menu-current-date-v3');
      sessionStorage.removeItem('drifter-menu-refresh-count');

      const storedValue = sessionStorage.getItem(storageKey);
      const parsed = storedValue ? new Date(storedValue) : null;
      const displayDate = parsed && !Number.isNaN(parsed.getTime())
        ? new Date(parsed)
        : new Date(start);
      const nextDate = new Date(displayDate);
      nextDate.setDate(nextDate.getDate() + 1);
      sessionStorage.setItem(storageKey, nextDate.toISOString());

      this.menuDateValue = displayDate;
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

  private renderTagline(): HTMLElement {
    const tag = el('div');
    tag.className = 'drifter-tagline';
    tag.textContent = 'THE SIGNAL IS WEAK, BUT IT\'S STILL CALLING.';
    return tag;
  }

  // ── Main nav panel ───────────────────────────────────────────────────────────
  private renderMenuNav(): HTMLElement {
    const wrap = el('div');
    Object.assign(wrap.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      pointerEvents: 'auto',
    });

    const header = el('div');
    Object.assign(header.style, {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '0.65rem',
      letterSpacing: '0.22em',
      color: 'var(--text-secondary)',
      textTransform: 'uppercase',
      marginBottom: '10px',
    });
    header.textContent = 'SELECT ACCESS NODE';
    wrap.appendChild(header);

    const navItems: [string, string, () => void][] = [
      ['[01] EXPERIENCE THE CRACK IN REALITY', '', () => this.setMode('story')],
      ['[02] EXPLORATION RUN', '', () => this.setMode('exploration')],
      ['[03] SETTINGS', '', () => this.setMode('settings')],
    ];

    for (let idx = 0; idx < navItems.length; idx += 1) {
      const [label, , onClick] = navItems[idx];
      const item = el('div');
      item.className = 'drifter-menu-item';
      if (idx === this.menuIndex) item.classList.add('active');
      item.textContent = label;
      item.onclick = () => {
        this.menuIndex = idx;
        this.audio.playSelect();
        onClick();
      };
      item.onmouseenter = () => {
        this.menuIndex = idx;
        this.audio.playHover();
        this.render();
      };
      item.tabIndex = 0;
      item.onkeydown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          onClick();
        }
      };
      wrap.appendChild(item);
    }

    return wrap;
  }

  // ── Story panel ──────────────────────────────────────────────────────────────
  private renderStoryPanel(): HTMLElement {
    const panel = el('div');
    panel.className = 'drifter-panel';
    Object.assign(panel.style, { padding: '20px' });

    const header = el('div', {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '0.65rem',
      letterSpacing: '0.2em',
      color: 'var(--text-secondary)',
      marginBottom: '14px',
    });
    header.textContent = 'STRUCTURED RUN · CHAPTER 01';
    panel.appendChild(header);

    const desc = el('p', {
      margin: '0 0 16px',
      fontSize: '0.9rem',
      lineHeight: '1.65',
      color: 'var(--text-secondary)',
    });
    desc.textContent = 'A signal crack opens the world. Reach the relay, log the world, survive the shadows. Structured narrative. Fixed drifter origin. One shot.';
    panel.appendChild(desc);

    const start = el('button');
    start.className = 'drifter-btn';
    start.textContent = 'DEPLOY DRIFTER · CHAPTER 01';
    start.onclick = () => { this.audio.playSelect(); this.startRun('story'); };
    panel.appendChild(start);

    const back = el('button');
    back.className = 'drifter-btn secondary';
    back.textContent = '← Back to relay';
    back.onclick = () => { this.audio.playBack(); this.setMode('menu'); };
    Object.assign(back.style, { marginTop: '6px' });
    panel.appendChild(back);

    return panel;
  }

  // ── Exploration panel ────────────────────────────────────────────────────────
  private renderExplorationPanel(): HTMLElement {
    const panel = el('div');
    panel.className = 'drifter-panel';
    Object.assign(panel.style, { padding: '20px' });

    const header = el('div', {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '0.65rem',
      letterSpacing: '0.2em',
      color: 'var(--text-secondary)',
      marginBottom: '14px',
    });
    header.textContent = 'OPEN RUN · PROCEDURAL ZONE';
    panel.appendChild(header);

    const desc = el('p', {
      margin: '0 0 16px',
      fontSize: '0.9rem',
      lineHeight: '1.65',
      color: 'var(--text-secondary)',
    });
    desc.textContent = 'Procedural world. Fresh drifter. Move quietly, observe, catalog, extract. No two runs the same. Permadeath.';
    panel.appendChild(desc);

    // Difficulty slider
    const diffWrap = el('div', { marginBottom: '16px' });
    const diffLabel = el('div', {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '0.65rem',
      letterSpacing: '0.15em',
      color: 'var(--text-secondary)',
      marginBottom: '4px',
    });
    diffLabel.textContent = `DIFFICULTY — ${this.settings.difficulty}`;
    diffWrap.appendChild(diffLabel);

    const slider = el('input');
    slider.type = 'range';
    slider.min = '1';
    slider.max = '8';
    slider.value = String(this.settings.difficulty);
    slider.oninput = () => {
      this.settings.difficulty = Number(slider.value);
      diffLabel.textContent = `DIFFICULTY — ${this.settings.difficulty}`;
    };
    diffWrap.appendChild(slider);
    panel.appendChild(diffWrap);

    const start = el('button');
    start.className = 'drifter-btn';
    start.textContent = 'DEPLOY DRIFTER · OPEN RUN';
    start.onclick = () => { this.audio.playSelect(); this.startRun('exploration'); };
    panel.appendChild(start);

    const back = el('button');
    back.className = 'drifter-btn secondary';
    back.textContent = '← Back to relay';
    back.onclick = () => { this.audio.playBack(); this.setMode('menu'); };
    Object.assign(back.style, { marginTop: '6px' });
    panel.appendChild(back);

    return panel;
  }

  // ── Settings panel ───────────────────────────────────────────────────────────
  private renderSettingsPanel(): HTMLElement {
    const panel = el('div');
    panel.className = 'drifter-panel';
    Object.assign(panel.style, { padding: '20px' });

    const header = el('div', {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '0.65rem',
      letterSpacing: '0.2em',
      color: 'var(--text-secondary)',
      marginBottom: '14px',
    });
    header.textContent = '// RELAY SETTINGS';
    panel.appendChild(header);

    // Volume — persisted; the menu shell's storm audio reads the same key.
    panel.appendChild(this.makeSliderRow('VOLUME', 0, 100, Math.round(this.settings.volume * 100), (v) => {
      this.settings.volume = v / 100;
      this.audio.setVolume(this.settings.volume);
      saveSettings(this.settings);
    }));

    // Difficulty — feeds WorldGenerator on the next run.
    panel.appendChild(this.makeSliderRow('DIFFICULTY', 1, 8, this.settings.difficulty, (v) => {
      this.settings.difficulty = v;
      saveSettings(this.settings);
    }));

    // Hints toggle
    const hintRow = el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' });
    const hintLabel = el('span');
    hintLabel.className = 'drifter-label';
    hintLabel.textContent = 'HINTS';
    const hintToggle = el('button');
    hintToggle.className = 'drifter-btn';
    Object.assign(hintToggle.style, { width: 'auto', padding: '6px 14px', fontSize: '0.72rem' });
    hintToggle.textContent = this.settings.showHints ? 'ENABLED' : 'DISABLED';
    hintToggle.onclick = () => {
      this.settings.showHints = !this.settings.showHints;
      hintToggle.textContent = this.settings.showHints ? 'ENABLED' : 'DISABLED';
      saveSettings(this.settings);
    };
    hintRow.appendChild(hintLabel);
    hintRow.appendChild(hintToggle);
    panel.appendChild(hintRow);

    // Wrongness cycle (dev/debug shortcut)
    const wrongnessRow = el('div', { marginBottom: '16px' });
    const wrongLabel = el('div');
    wrongLabel.className = 'drifter-label';
    wrongLabel.textContent = 'SKY STATE (PREVIEW)';
    Object.assign(wrongLabel.style, { marginBottom: '8px' });
    wrongnessRow.appendChild(wrongLabel);

    const states = Object.values(WrongnessState);
    const stateGrid = el('div', { display: 'flex', flexWrap: 'wrap', gap: '4px' });
    for (const state of states) {
      const stateBtn = el('button');
      stateBtn.className = 'drifter-btn';
      Object.assign(stateBtn.style, {
        width: 'auto',
        padding: '4px 8px',
        fontSize: '0.6rem',
        letterSpacing: '0.08em',
        opacity: this.wrongnessState === state ? '1' : '0.45',
        borderColor: this.wrongnessState === state ? 'var(--accent-color)' : 'var(--border-color)',
      });
      stateBtn.textContent = state.replace('_', ' ');
      stateBtn.onclick = () => {
        this.wrongnessState = state;
        this.render();
      };
      stateGrid.appendChild(stateBtn);
    }
    wrongnessRow.appendChild(stateGrid);
    panel.appendChild(wrongnessRow);

    const back = el('button');
    back.className = 'drifter-btn secondary';
    back.textContent = '← Back to relay';
    back.onclick = () => { this.audio.playBack(); this.setMode('menu'); };
    panel.appendChild(back);

    return panel;
  }

  // ── Status bar (bottom of right pane) ───────────────────────────────────────
  private renderStatusBar(): HTMLElement {
    const bar = el('div');
    bar.className = 'bottom-bar';
    bar.textContent = `> ${this.statusMessage}`;
    return bar;
  }

  // ── Shared helpers ───────────────────────────────────────────────────────────

  private makeSliderRow(label: string, min: number, max: number, value: number, onChange: (v: number) => void): HTMLElement {
    const wrap = el('div', { marginBottom: '14px' });
    const lbl = el('div');
    lbl.className = 'drifter-label';
    Object.assign(lbl.style, { marginBottom: '4px' });
    lbl.textContent = `${label} — ${value}`;
    wrap.appendChild(lbl);
    const input = el('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    input.oninput = () => {
      const v = Number(input.value);
      lbl.textContent = `${label} — ${v}`;
      onChange(v);
    };
    wrap.appendChild(input);
    return wrap;
  }

  private setMode(mode: AppMode): void {
    this.mode = mode;
    if (mode === 'menu') {
      this.disposePlaySession();
      this.engine = null;
      this.currentZone = null;
      this.backgroundFolder = this.pickBackground();
      this.statusMessage = 'Relay node connection established. Standing by.';
      this.audio.applyWrongness(WrongnessState.GREY);
    }
    this.render();
  }

  private bgPath(file: string): string {
    return `${MENU_BACKGROUND_PATH_ROOT}/${encodeURIComponent(this.backgroundFolder)}/${file}`;
  }

  private pickBackground(): MenuBackgroundFolder {
    return MENU_BACKGROUND_FOLDERS[Math.floor(Math.random() * MENU_BACKGROUND_FOLDERS.length)];
  }

  private getSeed(): number {
    return Math.max(1000, Math.floor(Math.random() * 1_000_000));
  }

  private generateZone(): Zone {
    const gen = new WorldGenerator({ seed: this.getSeed(), zoneCount: 1, difficulty: this.settings.difficulty, era: 'Early Collapse' });
    const { zones } = gen.generate();
    // Sync wrongness state from generated zone
    if (zones[0]?.wrongnessState) {
      this.wrongnessState = zones[0].wrongnessState as WrongnessState;
    }
    return zones[0];
  }

  private pendingMode: 'story' | 'exploration' = 'exploration';

  private async startRun(mode: 'story' | 'exploration'): Promise<void> {
    this.pendingMode = mode;

    // ── Loading phase ─────────────────────────────────────────────────────────
    this.mode = 'loading';
    this.render();

    // Give the browser one frame to paint the loading screen before blocking work
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    this.currentZone = this.generateZone();
    if (this.currentZone) this.audio.applyWrongness(this.currentZone.wrongnessState as WrongnessState);
    this.engine = new GameplayEngine({
      seed: this.getSeed(),
      zone: this.currentZone,
      startPosition: { x: 128, y: 128 },
      huskOptions: {
        seed: this.getSeed(),
        zone: this.currentZone,
        huskCount: mode === 'story' ? 3 : 5,
        weather: this.currentZone.weatherState,
      },
      worldInfoOptions: { storageKey: 'drifter_home_screen' },
      zoneStreamerCallbacks: {
        onLoad: (zone, isCenter) => this.gameRuntime?.onZoneLoad(zone, isCenter),
        onUnload: (zoneId) => this.gameRuntime?.onZoneUnload(zoneId),
      },
    });
    await this.createPlaySession();

    // ── Briefing phase ────────────────────────────────────────────────────────
    this.mode = 'briefing';
    this.statusMessage = mode === 'story' ? 'Story run initiated. Keep the relay alive.' : 'Exploration run started. Move quietly.';
    this.render();
  }

  private launchFromBriefing(): void {
    this.mode = 'play';
    this.render();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (!(window as any).__DRIFTER_NO_AUTO_INIT__) {
    const app = new HomeScreen('app');
    app.run();
    (window as any).__DRIFTER_APP = app;
  }
});