import { WrongnessState } from '../types.js';
// ─── DOM helper ───────────────────────────────────────────────────────────────
export function el(tag, styles) {
    const e = document.createElement(tag);
    if (styles)
        Object.assign(e.style, styles);
    return e;
}
// ─── Noise canvas ─────────────────────────────────────────────────────────────
export function createNoiseCanvas(opacity) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    Object.assign(canvas.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        opacity: String(opacity),
        imageRendering: 'pixelated',
        pointerEvents: 'none',
    });
    const ctx = canvas.getContext('2d');
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
export const WRONGNESS_PALETTE = {
    [WrongnessState.SUNNY]: {
        panelBg: 'rgba(12, 18, 28, 0.72)', borderColor: 'rgba(180, 210, 255, 0.18)',
        accentColor: '#8bbfff', textPrimary: '#ddeeff', textSecondary: '#8aaccc',
        noiseOpacity: 0.0, scanlineOpacity: 0.0, glitch: false, label: 'SUNNY',
        skyFilter: 'brightness(0.85) saturate(1.1)',
    },
    [WrongnessState.BLUE]: {
        panelBg: 'rgba(8, 16, 32, 0.76)', borderColor: 'rgba(100, 160, 255, 0.22)',
        accentColor: '#6aadff', textPrimary: '#cce0ff', textSecondary: '#6a96c0',
        noiseOpacity: 0.02, scanlineOpacity: 0.02, glitch: false, label: 'BLUE',
        skyFilter: 'brightness(0.8) hue-rotate(-10deg) saturate(1.15)',
    },
    [WrongnessState.GREY]: {
        panelBg: 'rgba(10, 14, 20, 0.8)', borderColor: 'rgba(140, 160, 180, 0.2)',
        accentColor: '#aac4d8', textPrimary: '#c8d8e8', textSecondary: '#7a90a0',
        noiseOpacity: 0.03, scanlineOpacity: 0.03, glitch: false, label: 'GREY',
        skyFilter: 'brightness(0.72) saturate(0.6) contrast(1.05)',
    },
    [WrongnessState.RAINY]: {
        panelBg: 'rgba(6, 12, 22, 0.84)', borderColor: 'rgba(80, 130, 190, 0.25)',
        accentColor: '#5a9fcc', textPrimary: '#b0cce0', textSecondary: '#5a7a96',
        noiseOpacity: 0.05, scanlineOpacity: 0.06, glitch: false, label: 'RAINY',
        skyFilter: 'brightness(0.62) saturate(0.45) hue-rotate(-15deg)',
    },
    [WrongnessState.STATIC]: {
        panelBg: 'rgba(8, 10, 18, 0.86)', borderColor: 'rgba(160, 160, 200, 0.3)',
        accentColor: '#c0c8e0', textPrimary: '#c0c8e0', textSecondary: '#6a7090',
        noiseOpacity: 0.09, scanlineOpacity: 0.10, glitch: true, label: 'STATIC',
        skyFilter: 'brightness(0.58) saturate(0.2) contrast(1.1)',
    },
    [WrongnessState.UNKNOWN]: {
        panelBg: 'rgba(10, 8, 20, 0.88)', borderColor: 'rgba(180, 140, 255, 0.25)',
        accentColor: '#b08de0', textPrimary: '#c8b8f0', textSecondary: '#7060a0',
        noiseOpacity: 0.11, scanlineOpacity: 0.12, glitch: true, label: 'UNKNOWN',
        skyFilter: 'brightness(0.52) saturate(0.3) hue-rotate(30deg)',
    },
    [WrongnessState.STORMY]: {
        panelBg: 'rgba(6, 6, 14, 0.92)', borderColor: 'rgba(200, 160, 80, 0.3)',
        accentColor: '#d0a040', textPrimary: '#e0c880', textSecondary: '#806030',
        noiseOpacity: 0.14, scanlineOpacity: 0.16, glitch: true, label: 'STORMY',
        skyFilter: 'brightness(0.45) saturate(0.2) sepia(0.3) contrast(1.15)',
    },
    [WrongnessState.DIFFERENT]: {
        panelBg: 'rgba(8, 4, 18, 0.92)', borderColor: 'rgba(255, 80, 80, 0.3)',
        accentColor: '#ff6060', textPrimary: '#ffc0c0', textSecondary: '#804040',
        noiseOpacity: 0.18, scanlineOpacity: 0.20, glitch: true, label: 'A DIFFERENT SKY',
        skyFilter: 'brightness(0.38) saturate(0.15) hue-rotate(160deg) contrast(1.2)',
    },
    [WrongnessState.ANOTHER_SKY]: {
        panelBg: 'rgba(4, 0, 12, 0.96)', borderColor: 'rgba(255, 40, 40, 0.4)',
        accentColor: '#ff3030', textPrimary: '#ffaaaa', textSecondary: '#602020',
        noiseOpacity: 0.24, scanlineOpacity: 0.28, glitch: true, label: 'ANOTHER SKY',
        skyFilter: 'brightness(0.3) saturate(0.1) hue-rotate(180deg) contrast(1.3)',
    },
};
// ─── Theme application ────────────────────────────────────────────────────────
export function applyThemeVars(wrongness) {
    const p = WRONGNESS_PALETTE[wrongness];
    const r = document.documentElement;
    r.style.setProperty('--panel-bg', p.panelBg);
    r.style.setProperty('--border-color', p.borderColor);
    r.style.setProperty('--accent-color', p.accentColor);
    r.style.setProperty('--text-primary', p.textPrimary);
    r.style.setProperty('--text-secondary', p.textSecondary);
}
// ─── Global styles (injected once) ───────────────────────────────────────────
export function injectGlobalStyles() {
    if (document.getElementById('drifter-global-styles'))
        return;
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

    @keyframes text-flicker {
      0%, 97%, 100% { opacity: 1; }
      98% { opacity: 0.3; }
      99% { opacity: 0.8; }
    }

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

    @keyframes sig-arc-spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
    @keyframes sig-arc-pulse { 0%,100%{opacity:0.7} 50%{opacity:1} }

    @keyframes sig-morse-long  { 0%,100%{opacity:0.15} 10%,55%{opacity:0.9} 56%,100%{opacity:0.15} }
    @keyframes sig-morse-short { 0%,100%{opacity:0.15} 65%,80%{opacity:0.9} 81%,100%{opacity:0.15} }
    @keyframes sig-morse-dot   { 0%,100%{opacity:0.15} 88%,96%{opacity:0.9} 97%,100%{opacity:0.15} }

    .sig-morse-dash {
      height: 3px;
      border-radius: 999px;
      background: rgba(255,200,80,0.85);
      transform-origin: left;
    }

    @keyframes sig-static-a { 0%,100%{opacity:0.1;transform:scaleX(1)} 17%{opacity:0.8;transform:scaleX(0.6)} 33%{opacity:0.2;transform:scaleX(1.2)} }
    @keyframes sig-static-b { 0%,100%{opacity:0.05;transform:scaleX(1)} 42%{opacity:0.9;transform:scaleX(0.4)} 58%{opacity:0.1;transform:scaleX(0.9)} }
    @keyframes sig-static-c { 0%,100%{opacity:0.15;transform:scaleX(1)} 71%{opacity:0.7;transform:scaleX(1.3)} 80%{opacity:0.05} }

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

    .drifter-panel {
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

    .drifter-panel.glitching { animation: glitch-border 6s infinite; }

    .drifter-menu-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: flex-start;
      padding: 0 0 52px 52px;
      width: min(500px, 48vw);
      max-width: 560px;
      height: 100%;
      pointer-events: auto;
      background: linear-gradient(to right, rgba(2,4,10,0.82) 0%, rgba(2,4,10,0.40) 70%, transparent 100%);
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
      gap: 0.9rem;
      font-family: 'Share Tech Mono', monospace;
      font-size: 0.82rem;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: rgba(160,185,210,0.65);
      cursor: pointer;
      background: transparent;
      border: none;
      padding: 8px 0;
      outline: none;
      position: relative;
      width: fit-content;
      min-width: 100%;
      transition: color 0.15s ease;
    }

    .drifter-menu-item::before {
      content: '';
      width: 18px;
      height: 1px;
      background: transparent;
      transition: background 0.18s ease, width 0.18s ease;
      flex-shrink: 0;
    }

    .drifter-menu-item.active {
      color: var(--text-primary);
    }

    .drifter-menu-item.active::before {
      background: var(--accent-color);
      width: 28px;
      box-shadow: 0 0 8px rgba(84,230,164,0.4);
    }

    .drifter-menu-item:hover { color: var(--text-primary); }
    .drifter-menu-item:hover::before { background: rgba(255,255,255,0.3); width: 24px; }

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
      left: 0; top: 0; bottom: 0;
      width: 3px;
      background: var(--accent-color);
      transform: scaleY(0);
      transform-origin: bottom;
      transition: transform 0.18s ease;
    }

    .drifter-btn:hover { background: rgba(255,255,255,0.06); border-color: var(--accent-color); }
    .drifter-btn:hover::after { transform: scaleY(1); }
    .drifter-btn:active { background: rgba(255,255,255,0.1); }
    .drifter-btn.secondary { opacity: 0.6; font-size: 0.85rem; }
    .drifter-btn.secondary:hover { opacity: 1; }

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
      width: 5px; height: 5px;
      border-radius: 50%;
      background: var(--accent-color);
      animation: signal-pulse 2s ease-in-out infinite;
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
      width: 14px; height: 14px;
      background: var(--accent-color);
      cursor: pointer;
    }

    input[type="range"]::-moz-range-thumb {
      width: 14px; height: 14px;
      background: var(--accent-color);
      border: none;
      cursor: pointer;
    }

    @keyframes drifter-scan { 0%{left:-60%} 100%{left:110%} }

    /* ── Mobile responsive ──────────────────────────────────────────────────── */

    /* Menu overlay: full-width bottom sheet on mobile */
    @media (max-width: 640px) {
      .drifter-menu-overlay {
        width: 100% !important;
        max-width: 100% !important;
        padding: 24px 24px 36px 24px !important;
        justify-content: flex-end !important;
        background: linear-gradient(to top, rgba(6,10,18,0.92) 0%, rgba(6,10,18,0.0) 55%);
      }

      /* Split layout: stack vertically instead of side-by-side */
      .drifter-split-layout {
        flex-direction: column !important;
        justify-content: flex-end !important;
        overflow-y: auto !important;
      }

      .drifter-split-left {
        display: none !important;
      }

      .drifter-split-right {
        width: 100% !important;
        max-width: 100% !important;
        padding: 24px 20px 36px 20px !important;
        justify-content: flex-end !important;
        max-height: 80vh !important;
        overflow-y: auto !important;
      }

      /* Bigger tap targets for menu items */
      .drifter-menu-item {
        font-size: 1.05rem !important;
        padding: 10px 0 !important;
        min-height: 44px !important;
      }

      /* Buttons: full tap height */
      .drifter-btn {
        padding: 16px 20px !important;
        font-size: 0.95rem !important;
        min-height: 48px !important;
      }

      /* Title: smaller on mobile */
      h1.drifter-title {
        font-size: clamp(2.2rem, 10vw, 3rem) !important;
      }

      /* Moon: smaller on mobile, move out of the way */
      .drifter-moon {
        width: 56px !important;
        height: 56px !important;
        top: 6% !important;
        right: 8% !important;
      }

      /* Status rows: tighter */
      .drifter-inline-status {
        font-size: 0.72rem !important;
        gap: 7px !important;
      }

      /* Panel scroll on mobile */
      .drifter-panel {
        max-height: 55vh !important;
        overflow-y: auto !important;
      }

      /* Range slider: larger thumb */
      input[type="range"]::-webkit-slider-thumb {
        width: 20px !important;
        height: 20px !important;
      }
    }

    /* Tablet: mid-range adjustments */
    @media (min-width: 641px) and (max-width: 900px) {
      .drifter-menu-overlay {
        width: min(380px, 52vw) !important;
      }
      .drifter-split-right {
        width: clamp(280px, 46vw, 420px) !important;
      }
    }

    /* Touch devices: remove hover-only states that feel broken on tap */
    @media (hover: none) and (pointer: coarse) {
      .drifter-menu-item:hover { color: var(--text-primary); }
      .drifter-btn:hover { background: transparent; border-color: var(--border-color); }
      .drifter-btn:hover::after { transform: scaleY(0); }
      .drifter-btn:active { background: rgba(255,255,255,0.1); border-color: var(--accent-color); }
      .drifter-btn:active::after { transform: scaleY(1); }
    }
  `;
    document.head.appendChild(style);
}
//# sourceMappingURL=ui-shared.js.map