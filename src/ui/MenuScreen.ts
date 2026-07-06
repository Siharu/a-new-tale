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

    const moon = document.createElement('div');
    moon.className = 'drifter-moon';
    bg.appendChild(moon);

    const vignette = el('div', {
      position: 'absolute', inset: '0',
      background: 'linear-gradient(to top, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.0) 48%)',
      pointerEvents: 'none',
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

    const title = el('h1', {
      margin: '0 0 4px',
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: 'clamp(1.6rem, 3.2vw, 2.4rem)',
      fontWeight: '400', letterSpacing: '0.18em',
      textTransform: 'uppercase', lineHeight: '1.25',
      color: 'var(--text-primary)',
    });
    title.className = 'drifter-title';
    title.innerHTML = "A DRIFTER'S<br>TALE";
    wrap.appendChild(title);

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

    // Dev sky-state preview
    const wrongnessRow = el('div', { marginBottom: '16px' });
    const wLbl = el('div');
    wLbl.className = 'drifter-label';
    wLbl.textContent = 'SKY STATE (PREVIEW)';
    wLbl.style.marginBottom = '8px';
    wrongnessRow.appendChild(wLbl);

    const grid = el('div', { display: 'flex', flexWrap: 'wrap', gap: '4px' });
    for (const state of Object.values(WrongnessState)) {
      const btn = el('button');
      btn.className = 'drifter-btn';
      Object.assign(btn.style, {
        width: 'auto', padding: '4px 8px', fontSize: '0.6rem', letterSpacing: '0.08em',
        opacity: this.wrongnessState === state ? '1' : '0.45',
        borderColor: this.wrongnessState === state ? 'var(--accent-color)' : 'var(--border-color)',
      });
      btn.textContent = state.replace('_', ' ');
      btn.onclick = () => {
        this.wrongnessState = state;
        this.callbacks.onWrongnessChange(state);
        this.render();
      };
      grid.appendChild(btn);
    }
    wrongnessRow.appendChild(grid);
    panel.appendChild(wrongnessRow);

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

    const wrap = el('div', { position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2,4,8,0.96)', zIndex: '10', pointerEvents: 'auto' });
    const card = el('div', { maxWidth: '540px', width: '90%', padding: '32px 36px', background: 'rgba(6,12,22,0.95)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', gap: '20px' });

    const eyebrow = el('div', { fontFamily: "'Share Tech Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(84,230,164,0.65)', marginBottom: '8px' });
    eyebrow.textContent = `WNCORE · ${mode === 'story' ? 'STRUCTURED RUN' : 'OPEN RUN'} · PRE-DEPLOYMENT BRIEF`;
    const nameEl = el('div', { fontFamily: "'Rajdhani', system-ui, sans-serif", fontSize: '1.4rem', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(220,235,248,0.95)' });
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

    const canvasWrap = el('div', { position: 'absolute', inset: '0', zIndex: '0', pointerEvents: 'none', background: 'radial-gradient(circle at center, rgba(4,10,18,0.18) 0%, rgba(2,4,8,0.88) 70%, rgba(1,2,4,1) 100%)' });
    const canvas = runtime.canvas;
    Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block', objectFit: 'cover', pointerEvents: 'none', filter: 'contrast(1.04) saturate(1.05)' });
    canvasWrap.appendChild(canvas);
    surface.appendChild(canvasWrap);
    runtime.handleResize();

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
          <div style="font-family:'Rajdhani',system-ui,sans-serif;font-size:1rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-primary);margin-bottom:4px;">${zone?.name ?? 'RELAY ZONE'}</div>
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