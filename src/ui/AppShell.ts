/**
 * AppShell
 * ─────────────────────────────────────────────────────────────────────────────
 * Top-level orchestrator. Constructs DrifterAudio and MenuScreen, wires their
 * callbacks, and owns the run lifecycle (zone generation → engine init →
 * GameRuntime start/stop → menu return).
 *
 * Responsibilities:
 *   ✓ Boot audio on first user gesture
 *   ✓ Generate zones + construct GameplayEngine
 *   ✓ Create / destroy GameRuntime instances
 *   ✓ Transition between menu modes (menu → loading → briefing → play → menu)
 *   ✓ Run-complete overlay
 *
 * NOT responsible for:
 *   ✗ Building any DOM beyond the root #app container
 *   ✗ Rendering menus, panels, or the HUD (MenuScreen owns that)
 *   ✗ Web Audio primitives (DrifterAudio owns that)
 *   ✗ Three.js scene, sprites, input (GameRuntime owns that)
 */

import type { Zone } from '../types.js';
import { WrongnessState } from '../types.js';
import { WorldGenerator } from '../worldgen.js';
import { GameplayEngine } from '../gameplay/index.js';
import { GameRuntime } from './GameRuntime.js';
import { DrifterAudio } from './DrifterAudio.js';
import { MenuScreen, loadSettings, saveSettings } from './MenuScreen.js';
import { el, injectGlobalStyles } from './ui-shared.js';
import { cursor } from './AnimatedCursor.js';

export class AppShell {
  private root: HTMLElement;
  private audio: DrifterAudio;
  private menu: MenuScreen;

  private engine: GameplayEngine | null = null;
  private runtime: GameRuntime | null = null;
  private currentZone: Zone | null = null;
  /** Backdrop wrap holding runtime.canvas during the briefing screen's
   *  cinematic preview — removed once launchFromBriefing() re-parents the
   *  canvas into the real play HUD, or on disposeRun() if the player backs
   *  out without deploying. */
  private briefingCanvasWrap: HTMLElement | null = null;
  private wrongnessState: WrongnessState = WrongnessState.GREY;

  // Play surface — injected into root alongside the menu layer when in play mode
  private playSurface: HTMLElement | null = null;

  constructor(rootId = 'app') {
    const root = document.getElementById(rootId);
    if (!root) throw new Error(`AppShell: no #${rootId}`);
    this.root = root;

    injectGlobalStyles();

    // Apply glitch cursor to the whole app
    cursor.apply(document.body);

    const settings = loadSettings();
    this.audio = new DrifterAudio();
    this.audio.setVolume(settings.volume);

    this.menu = new MenuScreen(this.root, this.audio, {
      onStartRun: (mode) => this.handleStartRun(mode),
      onWrongnessChange: (state) => { this.wrongnessState = state; this.audio.applyWrongness(state); },
      onVolumeChange: (v) => this.audio.setVolume(v),
      onSettingsSave: (s) => saveSettings(s),
    });

    // AudioContext requires a user gesture — wire once, remove after first fire
    const startAudio = () => {
      this.audio.startAmbient(this.wrongnessState);
      window.removeEventListener('click', startAudio);
      window.removeEventListener('keydown', startAudio);
      window.removeEventListener('touchstart', startAudio);
    };
    window.addEventListener('click', startAudio, { once: true });
    window.addEventListener('keydown', startAudio, { once: true });
    window.addEventListener('touchstart', startAudio, { once: true });
  }

  run(): void {
    this.menu.setMode('menu');
    this.menu.render();
  }

  // ── Public surface for GameRuntime escape-hatch (ESC key) ────────────────────

  showMenu(): void {
    this.disposeRun();
    this.wrongnessState = WrongnessState.GREY;
    this.menu.wrongnessState = this.wrongnessState;
    this.menu.currentZone = null;
    this.menu.engine = null;
    this.menu.rotateBg();
    this.menu.setStatus('Relay node connection established. Standing by.');
    this.audio.applyWrongness(WrongnessState.GREY);
    this.menu.setMode('menu');
    this.menu.render();
  }

  // ── Run lifecycle ────────────────────────────────────────────────────────────

  /**
   * Called by MenuScreen callbacks in two situations:
   *   1. "Deploy" button on story/exploration panel → triggers loading → briefing
   *   2. "Confirm" button on briefing screen → triggers actual launch (mode='play')
   *
   * We distinguish by MenuScreen's current mode:
   *   if menu is on briefing when this fires, launch the play session.
   *   otherwise, start the loading flow.
   */
  private handleStartRun(mode: 'story' | 'exploration'): void {
    // The briefing "Confirm" button sets mode to 'play' then fires onStartRun.
    // Intercept that to avoid re-running the full loading flow.
    if (this.menu['mode'] === 'play') {
      this.launchFromBriefing();
      return;
    }
    void this.startRun(mode);
  }

  private async startRun(mode: 'story' | 'exploration'): Promise<void> {
    this.menu.pendingMode = mode;

    // Loading screen
    this.menu.setMode('loading');
    this.menu.render();

    // Yield two frames so the browser can paint the loading screen before
    // blocking world generation work.
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    // World generation
    this.currentZone = this.generateZone();
    this.wrongnessState = (this.currentZone.wrongnessState as WrongnessState) ?? WrongnessState.GREY;
    this.audio.applyWrongness(this.wrongnessState);

    // Engine construction
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
      worldInfoOptions: { storageKey: 'drifter_app_shell' },
      zoneStreamerCallbacks: {
        onLoad: (zone, isCenter) => this.runtime?.onZoneLoad(zone, isCenter),
        onUnload: (zoneId) => this.runtime?.onZoneUnload(zoneId),
      },
    });

    // Hand refs to MenuScreen so HUD / briefing can read them
    this.menu.currentZone = this.currentZone;
    this.menu.engine = this.engine;
    this.menu.wrongnessState = this.wrongnessState;

    // Build GameRuntime now (not at launch) so the briefing screen can show a
    // live cinematic preview of the zone the drifter's about to drop into.
    // Gameplay stays suspended (enterCinematic()) until launchFromBriefing().
    this.runtime = new GameRuntime(this.engine, this.currentZone);
    this.runtime.audio = this.audio;
    this.runtime.onRunComplete = () => {
      this.engine?.completeRun();
      this.showRunComplete();
    };
    this.runtime.onRunFail = (cause: string) => {
      this.showRunFail(cause);
    };

    // Backdrop wrap sits behind the briefing card (which has its own zIndex).
    // Insert into the DOM before start() for the same reason as before: Three.js
    // needs real clientWidth/clientHeight on first tick, which requires the
    // canvas to already be laid out.
    const canvasWrap = el('div', { position: 'absolute', inset: '0', zIndex: '0', pointerEvents: 'none' });
    Object.assign(this.runtime.canvas.style, { width: '100%', height: '100%', display: 'block' });
    canvasWrap.appendChild(this.runtime.canvas);
    this.root.appendChild(canvasWrap);
    this.briefingCanvasWrap = canvasWrap;

    await new Promise<void>(r => requestAnimationFrame(() => r()));
    this.runtime.handleResize();
    await this.runtime.start();
    this.runtime.enterCinematic();

    // Briefing screen
    const statusMsg = mode === 'story'
      ? 'Story run initiated. Keep the relay alive.'
      : 'Exploration run started. Move quietly.';
    this.menu.setStatus(statusMsg);
    this.menu.setMode('briefing');
    this.menu.render();
  }

  private async launchFromBriefing(): Promise<void> {
    if (!this.engine || !this.currentZone || !this.runtime) return;

    // Resume real gameplay — camera back to fixed iso, ticking un-suspended.
    this.runtime.exitCinematic();

    this.menu.destroy();
    const playSurface = this.menu.buildPlayHUD(this.runtime, () => this.showMenu());
    // buildPlayHUD re-parents runtime.canvas into its own wrap — the briefing
    // backdrop wrap is now empty, safe to remove.
    this.briefingCanvasWrap?.remove();
    this.briefingCanvasWrap = null;
    this.root.appendChild(playSurface);
    this.playSurface = playSurface;

    await new Promise<void>(r => requestAnimationFrame(() => r()));
    this.runtime.handleResize();

    // Runtime is already started/ticking (from startRun's cinematic preview) —
    // no second start() call needed here.

    // Start expedition ambient
    this.audio.startAmbient(this.currentZone.wrongnessState);

    // Attach goal HUD element (created inside buildPlayHUD)
    const goalEl = playSurface.querySelector<HTMLDivElement>('#drifter-goal-hud');
    if (goalEl) this.runtime.attachGoalHUD(goalEl);

    // Register ESC → showMenu on window for GameRuntime's escape hatch
    (window as any).__DRIFTER_APP = this;
  }

  private disposeRun(): void {
    this.audio.stopAmbient();
    if (this.runtime) {
      this.runtime.stop();
      this.runtime = null;
    }
    if (this.briefingCanvasWrap) {
      this.briefingCanvasWrap.remove();
      this.briefingCanvasWrap = null;
    }
    if (this.playSurface) {
      this.playSurface.remove();
      this.playSurface = null;
    }
    this.engine = null;
    this.currentZone = null;
  }

  private showRunComplete(): void {
    const overlay = el('div', {
      position: 'fixed', inset: '0', zIndex: '90',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: '12px',
      background: 'rgba(2,4,8,0.9)', backdropFilter: 'blur(4px)',
    });

    const title = el('div', {
      fontFamily: "'Rubik Glitch', 'Rajdhani', system-ui, sans-serif",
      fontSize: '2.2rem', letterSpacing: '0.1em', textTransform: 'uppercase',
      color: 'var(--accent-color)', textShadow: '0 0 30px rgba(84,230,164,0.3)',
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
      fontFamily: "'Share Tech Mono', monospace", fontSize: '0.72rem',
      letterSpacing: '0.18em', textTransform: 'uppercase',
      color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.8',
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

  private showRunFail(cause: string): void {
    const overlay = el('div', {
      position: 'fixed', inset: '0', zIndex: '90',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: '12px',
      background: 'rgba(4,1,1,0.94)', backdropFilter: 'blur(4px)',
    });

    const title = el('div', {
      fontFamily: "'Rubik Glitch', 'Rajdhani', system-ui, sans-serif",
      fontSize: '2.2rem', letterSpacing: '0.1em', textTransform: 'uppercase',
      color: '#ff4a3a', textShadow: '0 0 30px rgba(255,60,40,0.35)',
    });
    title.textContent = 'SIGNAL LOST';

    const drifterName = this.engine?.drifter.name ?? 'DRIFTER';
    const DEATH_LINES = [
      'The relay went dark. No recovery signal detected.',
      'Last transmission corrupted. Drifter unaccounted for.',
      'Zone consumed another one. The logbook stays open.',
      "They didn't make it back. Add them to the list.",
      'No extraction. The silence said everything.',
    ];
    const deathLine = DEATH_LINES[Math.floor(Math.random() * DEATH_LINES.length)];

    const sub = el('div', {
      fontFamily: "'Share Tech Mono', monospace", fontSize: '0.72rem',
      letterSpacing: '0.18em', textTransform: 'uppercase',
      color: 'rgba(180,140,140,0.7)', textAlign: 'center', lineHeight: '1.8',
    });
    sub.innerHTML = `DRIFTER LOST · ${drifterName}<br><span style="color:rgba(200,100,100,0.5);font-size:0.6rem;">${cause}</span><br><br><span style="color:rgba(140,110,110,0.45);font-size:0.65rem;letter-spacing:0.1em;text-transform:none;">"${deathLine}"</span>`;

    overlay.appendChild(title);
    overlay.appendChild(sub);
    document.body.appendChild(overlay);

    window.setTimeout(() => {
      overlay.remove();
      this.showMenu();
    }, 4200);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private getSeed(): number {
    return Math.max(1000, Math.floor(Math.random() * 1_000_000));
  }

  private generateZone(): Zone {
    const gen = new WorldGenerator({
      seed: this.getSeed(),
      zoneCount: 1,
      difficulty: this.menu.settings.difficulty,
      era: 'Early Collapse',
    });
    const { zones } = gen.generate();
    return zones[0];
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  if (!(window as any).__DRIFTER_NO_AUTO_INIT__) {
    const app = new AppShell('app');
    app.run();
    (window as any).__DRIFTER_APP = app;
  }
});
