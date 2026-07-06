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
export declare class AppShell {
    private root;
    private audio;
    private menu;
    private engine;
    private runtime;
    private currentZone;
    private wrongnessState;
    private playSurface;
    constructor(rootId?: string);
    run(): void;
    showMenu(): void;
    /**
     * Called by MenuScreen callbacks in two situations:
     *   1. "Deploy" button on story/exploration panel → triggers loading → briefing
     *   2. "Confirm" button on briefing screen → triggers actual launch (mode='play')
     *
     * We distinguish by MenuScreen's current mode:
     *   if menu is on briefing when this fires, launch the play session.
     *   otherwise, start the loading flow.
     */
    private handleStartRun;
    private startRun;
    private launchFromBriefing;
    private disposeRun;
    private showRunComplete;
    private getSeed;
    private generateZone;
}
//# sourceMappingURL=AppShell.d.ts.map