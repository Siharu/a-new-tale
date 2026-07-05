# DRIFTER ENGINE — DETAILED DEVELOPMENT PLAN

**Project:** drifter.html (Another Sky universe)  
**Tech Stack:** TypeScript + Three.js + SVG procedural generation  
**Visual Style:** HD-2D isometric (Octopath Traveler + Aegis Rim lighting)  
**Concept Reference:** Relay Station 7 mood board (1. In-game scene demo section)  

---

## PHASE 0: ARCHITECTURE FOUNDATION

> **HANDOFF STATUS (JULY 1, 2026 — PHASE 3 DATA COMPLETE):**
> **✅ VERIFIED WORKING in Codespaces** (repo: `drifter-s-tale`, all work browser-only, no local machine):
> - **Phase 0-1: DATA LAYER FOUNDATION** — `types.ts` (enums + interfaces), `utils.ts` (RNG/ID/noise), `worldgen.ts` (procedural generation), `index.ts` (exports)
> - **Phase 2: RENDERING PIPELINE COMPLETE** (10 systems, all verified):
>   - `SkySystem.ts` — 9 discrete WrongnessStates (SUNNY → ANOTHER_SKY), per-state RGB tint/desat/haze, Moon persistent object, ObsediaRain overlay
>   - `PixelPipeline.ts`, `IsometricRenderer.ts`, `LightingController.ts`, `GodRayLayer.ts`, `DustParticles.ts`, `AtmosphereController.ts`, `IsoTileMap.ts`, `SVGBuildingFactory.ts`, `SVGRasterizer.ts` — all implemented, zero errors
> - **Phase 3: DATA LAYER — NOW COMPLETE** (all lore-accurate, spoiler-safe, sourced from Cygnus Signal Series bible):
>   - `src/data/husk_records.ts` — 23 threat types (9 Husks + 5 Infected + 1 Ghuul), observable behavioral traits only, survivor POV, zero references to real mechanism (rejection/veil)
>   - `src/data/fact_pools.ts` — 7 text pools, 240+ discoverable entries (Blank Zone/WW3/currency/regional naming/in-world theories only)
>   - `src/data/relay_station.json` — first hand-authored playable zone: WNCORE Relay Station 7, Dhaka Bangladesh, night 23:47, 4 buildings, 24 items, 2 Noire hazard zones, 2 story hooks
>   - Threat type enums exported from `types.ts`: `HuskType`, `InfectedType`, `GhuulType`, `DetectionMethod`
> - **Setup script:** `setup-data-folder.sh` (creates `src/data/` folder structure for Codespaces)
> - **Documentation:** `DATA_SETUP.md` (copy-paste instructions)
> - **Build status:** `npm run type-check` → zero errors. `npm run build` → clean. WorldGenerator verified (`✓ 6 zones, HQ at (256, 256)`)
>
> - **Session update (menu repair + atmosphere):**
>   - Restored `ui/home-screen.js` main menu functionality after a broken rewrite while preserving the original UI layout.
>   - Re-added cinematic atmosphere layers: fog, particles, god rays, relay glow, film grain, static noise, scanline overlay, and edge glow.
>   - Ensured every fullscreen atmospheric layer uses `pointer-events: none` and raised the menu root above effects with a higher z-index.
>   - Confirmed interactive `<button>` controls still exist and that `Settings`, `Experience the crack in reality`, and `Exploration` navigate correctly.
>   - Added keyboard support so `Escape` returns to the menu and `Enter` / `Space` activates focused buttons.
> - **Remaining work:**
>   - Final visual tuning to better match the prompt atmosphere without changing the menu design.
>   - Full browser runtime validation of effect stacking, input handling, and any hidden overlay capture.
>   - Connected menu actions to actual gameplay/run-start systems for Continue/New Game/Expedition/Settings. `menu.html` now imports `dist/ui/home-screen.js` and launches the actual `HomeScreen` runtime.
>   - `Archives` and `Credits` still use placeholder overlays and should be wired to real UI panels later.
>   - Preserve all original UI interaction behavior during further effect and polish work.
>
> **SESSION UPDATE (JULY 2, 2026 — PHASE 3 GAMEPLAY LAYER FOUND COMPLETE, NOT PREVIOUSLY DOCUMENTED):**
> A repo scan turned up a full Phase 3 gameplay layer already built and wired, beyond what this doc had recorded (doc previously said "Phase 3 gameplay is unstarted" — that's now out of date). Recording it here so it doesn't get rebuilt from scratch or lost to context drift:
> - **`src/gameplay/` (10 systems + engine root, all present and cross-wired):**
>   - `DrifterRoster.ts` — roster persistence across runs (permadeath-aware)
>   - `DrifterEntity.ts` — the player entity: stats, state, ties to a roster slot
>   - `MovementController.ts` — grid/vector movement, input-vector driven
>   - `ThreatModel.ts` (`ThreatEntity`, `ThreatDetectionContext`, `ThreatDetectionResult`) — detection-radius logic, type-aware (vibration/sight/hearing/nocturnal per husk type from the bible)
>   - `InteractionSystem.ts` (`InteractionContext`) — proximity + E-key interact, feeds CatalogSystem and InventorySystem
>   - `CatalogSystem.ts` — the discovery/logbook verb, pulls from `fact_pools.ts` and `husk_records.ts`
>   - `HuskSystem.ts` (`HuskEntity`, `HuskSystemCallbacks`, `HuskSystemOptions`, `HuskUpdateResult`) — patrol + escalation AI, per-zone husk population
>   - `InventorySystem.ts` — items, consumables, currency origin tracking
>   - `WorldInfoLayer.ts` (`WorldInfoDeposit`) — cross-run logbook deposits, localStorage-backed, includes the fake-logbook/Counter-Drifter mechanic from the bible
>   - `RunManager.ts` — closes the loop: permadeath, roster persistence, run lifecycle
>   - `ZoneStreamer.ts` — maintains a 3×3 zone window around the player, loads/unloads via `WorldGenerator` (deterministic — unload/reload of the same zone produces an identical `Zone` object), evicts textures through `TextureCache` on unload. Exposes `onLoad(zone, isCenter)` / `onUnload(zoneID)` callbacks and a `moveTo(gridPos)` / `flush()` API. **Currently only `moveTo` is called from `home-screen.ts` — the `onLoad`/`onUnload` callbacks are not wired to the renderer yet** (see below).
>   - `GameplayEngine.ts` — the composition root. Takes `{ seed, zone, startPosition, huskOptions, worldInfoOptions, rosterSeed, textureCacheOptions, zoneStreamerCallbacks }` and instantiates/wires all of the above plus `TextureCache`, `SVGRasterizer`, `SVGBuildingFactory`, and `WorldGenerator` into one object (`drifterEntity`, `movementController`, `interactionSystem`, `catalogSystem`, `inventorySystem`, `huskSystem`, `worldInfoLayer`, `runManager`, `zoneStreamer`, `buildingFactory`). This is what `home-screen.ts` instantiates on `startRun()`.
> - **`src/render/TextureCache.ts`** — LRU eviction wrapper over `SVGRasterizer`'s internal cache (which has no eviction policy on its own). Capacity-limited, evicts least-recently-used on overflow, exposes `evictZone()` so `ZoneStreamer` can tie GPU memory lifecycle to zone unload. This wasn't in the original "10 rendering systems" list — actual render-layer file count is 11.
> - **`src/ui/home-screen.ts` (1,382 lines, TypeScript — previously described in this doc as `ui/home-screen.js`, a JS file undergoing "menu repair." It has since been rebuilt/continued in TS and is substantially larger than a repair patch):**
>   - `AppMode = 'menu' | 'story' | 'exploration' | 'settings' | 'play'` — full state machine via `setMode()`/`startRun()`.
>   - Menu → `setMode('story' | 'exploration' | 'settings')` shows the relevant panel; each panel's "Begin"/"Start" button calls `startRun(mode)`, which constructs a real `GameplayEngine` (seeded, zoned, husk-populated) and flips to `'play'` mode. **This path is fully wired and functional** — earlier notes questioning whether Story/Exploration "actually transition to a play session" are resolved: they do.
>   - Play-mode scene: real ground plane + grid helper, sky attached via `SkySystem`, buildings rendered as **real dioramas** through `this.engine.buildingFactory.build(building, zoneId)` (the wired `SVGRasterizer → TextureCache → SVGBuildingFactory` pipeline) — not placeholder boxes. The one remaining `THREE.BoxGeometry` in this file (~line 869) is intentionally just the player-drifter marker mesh, not world geometry.
>   - Keyboard input (WASD/arrows) feeds a held-keys set into a movement input vector each frame.
>   - `zoneStreamer.moveTo({col:0,row:0})` is called on session start, but `GameplayEngine`'s `zoneStreamerCallbacks` option (`onLoad`/`onUnload`) is never passed in from `startRun()` — zone streaming runs in memory but doesn't yet add/remove Three.js scene objects as the player crosses zone boundaries. **Next concrete task:** wire `onLoad`/`onUnload` into scene-object add/remove in `home-screen.ts`.
> - **Root-level tooling not previously logged:** `deploy.sh` (unzips a `drifter-s-tale-fixed.zip` dropped in repo root and runs install/build in one command — built for the Codespaces-only, no-local-machine workflow), `build-dist.sh`, `sort-tiles.sh` + `slice-tiles.py` (tile-sheet slicing utilities for `assets/tiles/`), `vercel.json`, `test-browser.html`, `test.mjs`.
> - **`menu.html` (new, root-level, standalone):** A self-contained cinematic main-menu redesign — deliberately built outside the Vite/`home-screen.ts` pipeline so it opens directly in a browser with zero build step for fast look-and-feel iteration. Full-bleed `wncorelastbastion.png` background (WNCORE relay tower on a dark rain-lashed mountain ridge, single red aircraft-warning light at the tower tip), animated SVG rain, Web-Audio-generated rain loop + randomly-timed multi-strike lightning/thunder, a blinking SVG dot+glow locked to the tower light's actual pixel position in the source image (calibrated to ~66.1%/28.3% of image width/height), scanlines, film grain, vignette, morse-code flicker line, and a left-side nav panel (Continue / New Game / Expedition / Archives / Settings / Credits / Quit) with keyboard up/down navigation. **This is a visual mockup, not yet routed to `home-screen.ts`'s real `setMode()`/`startRun()` logic** — nav buttons currently just toggle `.active` state. Wiring it to the real engine is future work.
>
> **LORE CROSS-CHECK (JULY 2, 2026):** Re-read the bible's non-Som sections (Foundational Framework, Husks, Infected, Ghuuls, World Anomalies, Countries, Factions, In-World Theories, Timeline, WW3/Bite Rules/Immunes) against `husk_records.ts`, `fact_pools.ts`, and this doc's faction/anomaly summaries — no conflicts found, all current data holds up. One useful confirmation for the deferred `worldgen.ts` L146 work: the bible's World-2 timeline states the outbreak began **April 5, 2032, in Nepal villages** — this is exactly why the planned curated wrongness/region progression is framed as "Finland → Nepal" (Finland is one of the calmer Remaining-Governments-aligned countries; Nepal is outbreak ground zero, so it should read as the most "Another Sky"-state region). Worth keeping as the anchor point whenever that curated assignment actually gets designed.
>
> **SESSION UPDATE (JULY 2, 2026 — MENU ATMOSPHERE, ENTRY FLOW, AND RESPONSIVE POLISH):**
> - Built a standalone cinematic menu shell in `menu.html` with a full-bleed relay-station background, animated rain, lightning/thunder pulses, scanlines, noise, glitch title text, and a signal-network SVG overlay.
> - Restored the storm loop after a script conflict and confirmed the rain/thunder effects continue to run in the browser.
> - Embedded the red tower warning light directly into the background image asset so it reads as part of the scene rather than as a separate overlay.
> - Added responsive breakpoints for smaller screens so the title, status panels, and navigation stack reflow cleanly on mobile and tablet viewports.
> - Kept the menu entry flow aligned with the runtime shell: Continue/New Game/Expedition/Settings now transition into the real HomeScreen gameplay shell, while Archives/Credits remain placeholder overlays for future expansion.
> - Sanity-checked the local TypeScript build path after the UI pass; the compiler completed without reporting errors.
>
> **Bugs found and fixed across two sessions (don't reintroduce):**
> 1. `SVGRasterizer.ts` didn't exist — `SVGBuildingFactory.ts` was importing a phantom file.
> 2. `PixelPipeline.renderScene()` missing viewport reset — Three.js `setRenderTarget()` does NOT reset viewport (separate state), causing scene to render cropped into corner of 384×216 buffer. Fixed: explicit `setViewport(0,0,internalWidth,internalHeight)` before each scene render.
> 3. Building visuals were non-deterministic — `SVGBuildingFactory` hashed `building.id` (generated via `Date.now()+Math.random()`) for its visual seed. Fixed: added `seed: number` to `Building` interface in `types.ts`, populated from zone RNG stream in `worldgen.ts`, `SVGBuildingFactory` now reads `building.seed`. Verified deterministic via double-run test.
> 4. `test-tilemap.ts` sat in `src/render/` but imported from `./render/...` paths — off by one directory level, 4 import errors. Fixed to sibling imports.
> 5. `package.json` had `"three": "^r128"` — invalid npm tag, fixed to `"^0.160.0"`.
> 6. `tsconfig.json` deprecated `moduleResolution: "node"` — fixed to `"NodeNext"`.
> 7. `worldgen.ts` didn't populate `wrongnessState`/`region` after they were added as required fields to `Zone` — fixed with placeholder RNG assignment + `WrongnessState` import, flagged for curated replacement.
> 8. `@types/three` version mismatch — must stay pinned to `@types/three@0.160.0` to match `three@0.160.1`. Running `npm install @types/three` without pinning pulls latest (0.185+) which breaks everything.
>
> **LORE BIBLE — read before writing any catalog entries, logbook text, or husk/infected/ghuul data:**
>
> Source: `Cygnus_signal_series_Another_Sky_bible_and_others__only_me_and_helpers_should_know_not_the_readers_.md` — uploaded by Siharu, **do not ask for it again.**
>
> **⚠️ CRITICAL SPOILER RULE — NEVER VIOLATE IN ANY PLAYER-FACING TEXT:**
> The real nature of Husks (psychological rejection of breaking reality, the veil, dimensional exposure, Blank Zone connection to transformation) is the **end-of-game revelation**. Massive spoiler. Nothing in catalog entries, logbook deposits, HuskRecord descriptions, fact pools, or UI text may reference or hint at the real mechanism. Write everything from a scared survivor's POV who has no idea what's really happening. In-world characters only know what they've directly observed.
>
> What Drifters know in 2032: unknown pathogen, possibly viral, bite transmission observed, in-world theories only (signal-based brain rewiring / prion disease / undiscovered virus / fungus / drug hallucinations). Behavioral observations ONLY — what threats DO, not WHY.
>
> What NEVER appears in player-facing text: "They rejected reality" / "psychological response to truth" / "the veil" / "dimensional exposure" / any philosophical connection between Husks and forgotten truth.
>
> **HUSKS (9 types) — survivor-observed behavioral traits, no real mechanism:**
> Skoth: early/unstable, decomposing by 9 months, increasingly rare. Glowbubs: fixated on light, flee to nearest one, predictable. Jawies: aggressive, ram/break barriers, don't barricade against them. Whites: white hair, calcified fingers, detect vibration from kilometers — movement = death, stealth only. Oldbones: elderly hosts, restructured skeleton, hardened skull — head shots less effective. Disabled: blind→hyperhearing, deaf→extreme sight, crippled→mutated limbs, unpredictable detection. Noire: nocturnal only, groups of 2-3, slight coordination, completely still until movement — night gameplay fundamentally different. Bloaters: screams cascade nearby Husks, one can turn manageable into catastrophic — silence-critical. Aquatic: underwater, appear months in, slow but persistent, water zones become inaccessible.
>
> **INFECTED (6 types) — partial state, more dangerous intellectually than Husks:**
> All retain ~6-8yr old intelligence, avoid familiar humans, attack strangers, whisper unknown phrases, eyes reflect light, bite marks heal black/bloated, can blend into crowds. **Rain of Obsedia calms Infected completely — safe window, major gameplay mechanic.**
> Type-1 "They Think": strategize, plan, infiltrate. Type-2 "They Talk": speak naturally, blend into crowds, bite turns humans, enjoy killing. Type-3 "They Trick": mimic loved ones' voices, skinwalker-like, active evening-dawn. Type-4 "They Take": kidnap during sleep, eat prey alive, target children. Type-5 "Glitch": flicker between realities, move without biological constraints, unclassified.
>
> **GHUULS — apex threat, 173 known worldwide:**
> Created by simultaneous Husk + Infected bite. Pure white skin/hair (briefly turns brown in Rain of Obsedia — acts almost human, then reverts). Eyes flicker brown/black. Move like teleportation. Retain agency and emotion — NOT mindless. Shooting brain doesn't stop them. Effectively unkillable by normal Drifters. Tracked/counted by WNCORE.
>
> **WORLD ANOMALIES affecting gameplay:**
> Rain of Obsedia: black rain, global, daily, blocks sun (near-night conditions), calms Infected (safe window), makes Ghuuls briefly human, sky looks like it's bleeding.
> Fog of Medusa: yellow gas, **Germany ONLY**, kills all organic life, Husks unaffected, Infected die in it.
> Global Chilling: planet cooling, 5-6 hail events monthly, worst combined with black rain.
> Great Migration: trillions of insects/animals moving north, environmental/audio texture only.
>
> **FACTIONS — never conflate:**
> WNCORE (World News of Companion and Organized Radio Establishment): radio network, global news, Ghuul tracking. Relay station = Drifter HQ. Logbook Drifters: no official name, owl-holding-lizard logo, mass-produce/distribute logbooks about Husks/Infected/countries — **Counter-Drifter faction plants fake logbooks, real gameplay mechanic in WorldInfoLayer, player deposits cannot be blindly trusted.** Blood Pact: criminal syndicate, Antarctica, organ smuggling. Remaining Governments: Alaska stronghold, secretly planning to nuke all infected zones. Moon Dwellers: elites in Moon Dome, unknown status. Rooftop Seers: peaceful broadcasters, secretly infected. White Flag: pacifist aid NGO, cruise ship near London. Pale Node: scientists, ambiguous goals. Kraken's Paw: fishermen/oil workers, Southern Pacific.
>
> **REGIONAL NAMING (use in catalog entries and zone flavor):**
> Bangla: Mora/Dhar (husks), Bhromito/Monkharap (infected), Shada Bhuture (ghuuls). Japanese: Yurei, Kowai Hito, Shiro Oni. US slang: Meatbags/Screamers, Freaks/Echoes, Snow Demons. Hindi: Murda/Shaitan, Pagal/Bhatki Aatma, Safed Pret. Filipino: Multo/Bangkay, Naliligaw/Mga Sirang, Puting Halimaw.
>
> **WORLD SITUATION (2032):** Outbreak started Nepal April 5. WW3 2025-2027 (World-2 only). Blank Zone 2028-2031. Japan: island stronghold, Oldbones prevalent elsewhere. Russia: steel wall, Ghuul sightings. Australia: gone dark. Internet in pockets. WNCORE radio operational. Currency: home currency worthless in home region — foreign currency only has trade value (Bangladesh Drifter in Bangladesh: taka worthless, needs yen/USD/won etc).
>
> **✅ PHASE 3 DATA COMPLETE** — All three files written, lore-accurate, spoiler-safe, ready to copy into Codespaces:
> - `src/data/husk_records.ts` — ✅ 23 threat types, behavioral observations only
> - `src/data/fact_pools.ts` — ✅ 240+ lore entries, Blank Zone/WW3/currency/regional naming
> - `src/data/relay_station.json` — ✅ first playable zone, 4 buildings, 24 items, Noire packs
> 
> **⏭️ PHASE 3 GAMEPLAY — NEXT (entire `src/gameplay/` folder doesn't exist yet):**
> - `DrifterEntity.ts` + `DrifterRoster.ts` — player entity (randomized identity/stats per run), growing survivor pool
> - `MovementController.ts` — WASD + collision against `IsoTileMap` geometry
> - `ThreatModel.ts` — detection radius, noise level, line-of-sight, per-husk state machine (PATROL → ALERTED → INVESTIGATING → SPOTTED → PURSUING → ATTACKING → LOST)
> - `InteractionSystem.ts` — proximity detection, E-key, item pickup/observation
> - `CatalogSystem.ts` — 4 catalog types, per-Drifter fact-pool variance, max 4 deposits per run
> - `HuskSystem.ts` — patrol AI, escalation, progressive taxonomy (nameless until first catalog entry)
> - `InventorySystem.ts` — carry weight, consumables, foreign currency origin tracking
> - `WorldInfoLayer.ts` — cross-run deposit system (past Drifters' notes persist in localStorage, scattered into matching zone types in future runs)
> - `RunManager.ts` — phase state machine (HQ → Exploration → Resolution), permadeath, roster persistence
> - `TextureCache.ts` — LRU eviction by zone distance (SVGRasterizer's internal Map covers basic caching but has no eviction policy)
> - `ZoneStreamer.ts` — load/unload zones around player (3×3 window)
>
> **GAMEPLAY LOOP — LOCKED DESIGN (don't re-derive, don't re-ask Siharu):**
>
> Two modes, build roguelite first:
>
> **Roguelite Exploration (build now):**
> - Each run: fresh (or roster-pulled) Drifter, procedural world from WorldGenerator, new RNG countries/regions each time
> - Core verb: move quietly → observe → catalog → extract alive. NOT combat-first.
> - Every Drifter starts with bat or crowbar. Most have zero real fight competency (civilian realism). Avoidance/cataloging is the default.
> - Special recruit Drifters (rare weighted spawn) have real fight knowledge, can engage husks directly, collect samples, produce richer husk catalog entries
> - If RNG draws a survivor from the roster pool (Drifter who extracted alive in a previous run), they carry slightly more fight knowledge than a fresh recruit
> - Same item found by two different Drifters produces different catalog content — seeded per `hash(drifterSeed + itemTypeID)`, pulls from a fact pool with per-Drifter slice, no immediate repeats
> - Drifters can leave max 4 catalog deposits in the world per run — these persist to future runs via `WorldInfoLayer`, scattered into matching zone types
> - WNCORE and Logbook Drifters are **separate factions** — do not conflate them. WNCORE = radio station → global survival network. Logbook Drifters = faction from unknown org, average survivors + rare selective recruits.
>
> **4 Catalog Types (locked):**
> 1. Survival knowledge (diegetic tutorialization)
> 2. Safe zone locations (actual world coordinates attached)
> 3. Camp locations (actual world coordinates attached)
> 4. Husk/infected/Ghuul intel (ties to progressive HuskRecord taxonomy)
>
> **Husk taxonomy:** starts completely nameless, silhouette-ID only. Names/variants/weaknesses unlock through accumulated catalog entries and (for weaknesses) special-recruit sample collection. `HuskRecord` tracks `discoveredName`, `variants[]`, `weaknesses[]`, `encounterCount` across the whole career.
>
> **Currency:** old-world currency, but home currency is worthless in home region. Foreign currency only has trade value. Currency origin tracked per zone/region, valued differently depending on current Drifter location.
>
> **Survivor roster:** growing pool. Every Drifter who extracts alive is added. Future runs draw: 80% fresh generation, 20% pull from roster (if pool exists). Pool grows over a career — never resets unless player wipes save.
>
> **Story Mode (park until roguelite is solid):** 2–3 hours, fixed hand-authored regions, dialogue/NPC-driven, written by Siharu. Uses same rendering pipeline, different data source. Do not build any story mode systems yet.
>
> **Phase 3 build order (P1→P9 — start small wins):**
> P1: `relay_station.json` (data, no code, keystone for all testing)
> P2: `DrifterEntity.ts` + `DrifterRoster.ts`
> P3: `MovementController.ts`
> P4: `ThreatModel.ts` (detection only, no AI yet)
> P5: `InteractionSystem.ts` + `CatalogSystem.ts` (basic)
> P6: `HuskSystem.ts` (patrol + escalation)
> P7: `InventorySystem.ts`
> P8: `WorldInfoLayer.ts`
> P9: `RunManager.ts`
>
> **Environment note:** Siharu works entirely in browser GitHub Codespaces (`drifter-s-tale` repo, Codespace name "symmetrical space trout"). No local machine. All commands must be copy-pasteable into the Codespaces terminal.
>
> **Siharu's working style:** terse fragments, infer fast, propose defaults and act — don't over-ask. Wants real verified progress (actual terminal output, actual runtime confirmation) not theoretical completeness. Comfortable with technical depth. Prefers "small wins first" pacing — build incrementally, confirm each step works before layering the next.
>
> **Don't re-litigate settled decisions:** TS + Three.js + SVG procedural generation (locked). One-light-per-zone + god-rays/dust for atmosphere (locked). Sky as single source of truth (locked). CSS+SVG screen-space presets above WebGL canvas (locked). Hand-authored first map before procedural (locked). Roguelite before story mode (locked). Avoidance-first not combat-first loop (locked).
>
> **Cold-start sanity check:** run `ls dist/ && node test.mjs` in Codespaces terminal first. If it prints `✓ N zones, HQ at (x, y)`, foundation is intact — proceed to whatever the current P-step is. If it errors, diagnose before building anything new.




>
> **Repo specifics:** GitHub repo is named `drifter-s-tale` (NOT `drifter` — that was the originally planned name, actual repo got created with a different name, possibly auto-suggested by GitHub). Codespace title shows `drifter-s-tale [Codespaces: symmetrical space trout]`. Don't assume the repo name matches earlier conversation references to `drifter/` as a folder — check `pwd`/explorer sidebar if unsure.
>
> **Known gotchas already hit and fixed (don't reintroduce):**
> - `package.json` originally had `"three": "^r128"` — invalid npm tag syntax, causes `EINVALIDTAGNAME`. Fixed to `"^0.160.0"`. If touching `package.json` again, verify the three.js version stays valid semver.
> - `tsconfig.json` originally had `moduleResolution: "node"` (deprecated, throws in newer TS) — fixed to `"NodeNext"` to pair correctly with `module: "NodeNext"`. Don't revert to `"node"` or `"bundler"` — bundler resolution doesn't suit actual Node ESM execution which is what `npm run build` + `node test.mjs` rely on.
> - `worldgen.ts` had several strict-mode unused-variable/param errors from stubbed code (`noUnusedLocals`/`noUnusedParameters` in tsconfig are intentionally strict). Fixed by prefixing genuinely-unused stub params with `_` (e.g. `_roomID`, `_roomCount`) rather than disabling the lint rule — keep this convention for future stubs.
> - The setup flow requires TWO scripts run in order: `setup-folders.sh` then `setup-files.sh`. Running only one leaves things half-built (this exact confusion happened once — folders existed, `setup-files.sh` sat unrun, leading to a "ls src/ shows nothing" debugging detour). Always check both ran before troubleshooting deeper.
>
> **Asset status:** Folder structure exists and is empty (just `.gitkeep` placeholders). Siharu has NOT yet dragged in any real SVG/PNG/audio files as of this handoff. Don't assume any asset beyond what's referenced as "already on disk in WNCORE" — those still need manual copying over from the WNCORE Radio 2 repo, they don't auto-exist in this new `drifter-s-tale` repo.
>
> **Companion doc:** `DRIFTER_RENDERING_DEEPDIVE.md` has the full architecture for everything in the "NOT STARTED" list above (SkySystem, IsometricRenderer, PixelPipeline, LightingController, GodRayLayer, DustParticles, AtmosphereController + CSS presets, SVGBuildingFactory, SVGRasterizer, TextureCache, ZoneStreamer) including a concrete step-by-step build order (2.1 → 2.8), each step independently visually testable. Read that doc before writing any Phase 2 code — don't reinvent the architecture inline.
>
> **Siharu's working style (apply throughout):** Terse, directive fragments — infer intent quickly, don't ask excessive clarifying questions, propose a default and let them correct it. Prefers seeing concrete decisions made ("we should X") over open-ended option lists once enough context exists — but appreciates being asked A/B/C when a real fork in the road appears (e.g. "rendering first or data first"). Wants real verified progress (actual terminal output, actual build success) over theoretical completeness — confirm things actually run, don't just write code and assume it works. Comfortable with technical depth; no need to over-explain basics.
>
> **Don't re-litigate already-settled decisions:** TypeScript + Three.js + SVG procedural generation (locked), one-light-per-zone lighting approach with god-rays/dust doing the "wow" work (locked, validated against 13 Sentinels/Octopath references), sky-as-single-source-of-truth for fog/ambient/bloom color (locked), CSS+SVG screen-space atmosphere presets layered above the WebGL canvas (locked), hand-authored first map before procedural (locked — see "First Workable Map" section below). These came from real back-and-forth with reference images, not arbitrary choices — don't second-guess them without new information from Siharu.
>
> **Where everything lives (doc map):**
> - `DRIFTER_ENGINE_PLAN.md` (this file) — master plan, data layer architecture, asset folder structure, first map plan, this handoff block
> - `DRIFTER_RENDERING_DEEPDIVE.md` — separate file, full Phase 2 rendering architecture (SVG→texture pipeline, sky/lighting/atmosphere systems, CSS+SVG screen-space presets, build order 2.1–2.8). Read both before writing rendering code.
> - In the `drifter-s-tale` repo itself: `SETUP_README.md` covers the Codespaces setup flow (the two-script run order, devcontainer auto-provision option).
> - No other planning docs exist. If asked about something not in these two files, it hasn't been decided yet — ask Siharu, don't invent architecture.
>
> **Broader project context (only matters if asked, don't volunteer unprompted):** DRIFTER is one piece of the larger Another Sky transmedia universe — anchor novel + Simulunas + The Beyonders, shared lore (Fog of Medusa, WNCORE faction, the Cygnus signal). It's spun off as a standalone site specifically so the main WNCORE Radio 2 site (`navigator.html`, a separate existing project with its own working surveillance-game codebase) doesn't grow bloated. DRIFTER reuses WNCORE's portrait/item/weapon art assets but is otherwise a clean separate codebase with zero shared code — confirmed multiple times as a hard requirement ("ground up, no previous error gets in this"). Don't suggest importing WNCORE JS/logic into DRIFTER even if it'd be faster — that defeats the entire point of the rebuild.
>
> **If picking this up cold and unsure where to start:** run `ls dist/ && node test.mjs` in the Codespaces terminal first — if that prints `✓ N zones, HQ at (x, y)`, the foundation is still intact and you can proceed straight to the open decision (M1 vs. rendering step 2.1) above. If it errors, something regressed since this handoff — diagnose before building anything new on top.


### High-Level Vision
- **Procedurally generated post-apocalyptic ruins** (as big as scope allows)
- **Permadeath progression** — each run: new Drifter, new area, new time period
- **Investigation-survival loop** — explore buildings, scavenge evidence, decode lore chains, extract to HQ or die
- **Sky as atmospheric anchor** — procedurally varied colors/weather/corruption states
- **Minimal UI** — logbook, broadcast overlay, signal indicator, day/time counter

---

## CORE SYSTEMS (Build order by priority)

### 1. RENDERING FOUNDATION (Phase 1A)
**Goal:** Visual proof-of-concept matching mood board (Relay Station scene).

#### 1.1 IsometricRenderer
```ts
class IsometricRenderer {
  scene: THREE.Scene
  camera: THREE.OrthographicCamera  // Fixed 45° isometric view
  renderer: THREE.WebGLRenderer
  
  // Layers (back to front)
  skyLayer: SkySystem
  backgroundLayer: THREE.Group  // Static buildings/terrain
  entityLayer: THREE.Group      // Drifter, husks, interactive props
  uiLayer: HTMLElement          // Canvas overlay for logbook/UI
  
  methods:
    - init(canvas)
    - render()
    - setCameraPosition(worldX, worldY) // Follow drifter
    - screenToWorld(screenX, screenY) -> {worldX, worldY}
    - worldToScreen(worldX, worldY) -> {screenX, screenY}
}
```

**Constraints:**
- 640×480 canvas (matches Octopath/retro aesthetic)
- Orthographic camera, fixed 45° angle (no rotation/tilt)
- Depth sorting automatic via Three.js (no manual z-index)
- Lighting: ambient + directional + point lights for decay/corruption

#### 1.2 SkySystem
```ts
class SkySystem {
  // Procedural sky generation per zone/time
  baseColor: THREE.Color      // Driven by time-of-day + zone state
  fogColor: THREE.Color       // Fog of Medusa intensity
  cloudTexture: THREE.Texture // Procedurally generated or tiled
  corruptionOverlay: number   // 0–1, affects color shift
  
  // Animation
  timeOfDay: number           // 0–24 (hours)
  weatherState: WeatherType   // CLEAR | FOG_HEAVY | ACID_RAIN | STATIC_STORM
  
  methods:
    - init()
    - update(deltaTime, worldState)
    - getAmbientLight() -> THREE.Color
    - getDirectionalLight() -> THREE.Light
    - getCorruptionOverlay() -> THREE.ShaderMaterial (if shader-based)
    - procedureralCloudTexture(seed) -> THREE.Texture
}
```

**Concept mood board ref:** The sky in section 6 (Concept Art) dominates the visual — sunset orange, foggy gray, corrupted yellow-green. This needs to be animated (time cycle) and zone-aware.

#### 1.3 BuildingSVGGenerator
```ts
class BuildingSVGGenerator {
  // Generate building silhouettes, decay, window patterns
  
  methods:
    - generateBuilding(type: BuildingType, seed: number) -> SVGElement
      // Types: RESIDENTIAL | INDUSTRIAL | SIGNAL_TOWER | ARCHIVE | MAINTENANCE | RADIO_STATION
      // Returns: layered SVG (walls → windows → decay → rubble)
    
    - generateWindowLights(windowCount, timeOfDay) -> SVGElement
      // Procedural window placement + light glow
    
    - generateDecayStates(seed) -> Array<SVGElement>
      // 3–5 decay layers: pristine → damaged → collapsed → overgrown
    
    - buildingMesh(svgElement) -> THREE.Mesh
      // Composite SVG → texture → Three.js mesh for rendering
}
```

**Asset pipeline:** SVG is lightweight, scalable. Use for procedural building variance since we won't hand-paint hundreds.

---

### 2. WORLD GENERATION (Phase 1B)
**Goal:** Scope the world — how many zones, buildings, clues fit in memory?

#### 2.1 WorldGenerator
```ts
class WorldGenerator {
  worldSeed: number
  zones: Map<ZoneID, Zone>
  
  methods:
    - generate(seed: number, difficulty: number)
      // Create world layout at init
    
    - getZone(x, y) -> Zone
    
    - getBuilding(zoneID, buildingID) -> Building
}
```

#### 2.2 Zone
```ts
interface Zone {
  id: ZoneID
  name: string
  type: ZoneType  // RESIDENTIAL_DISTRICT | INDUSTRIAL_COMPLEX | RURAL_RELAY | SIGNAL_HUB
  position: {x: number, y: number}
  size: {width: number, height: number}
  
  // Procedural state
  seed: number
  timeOfDay: number  // Each zone can have different "time"?
  weatherState: WeatherType
  fogIntensity: number  // Fog of Medusa (0–1)
  decayLevel: number    // 0–1, affects building degradation
  
  // Content
  buildings: Building[]
  hazards: Hazard[]
  storyHooks: StoryHook[]  // Discovery anchors (you write, RNG distributes)
  items: Item[]
  
  // Extraction point
  hqEntrance: {x: number, y: number, interactable: boolean}
}
```

#### 2.3 Building
```ts
interface Building {
  id: BuildingID
  name: string
  type: BuildingType
  position: {x: number, y: number}  // Zone-relative
  size: {width: number, height: number}
  
  // Interior layout
  rooms: Room[]
  collisionGrid: boolean[][]  // Tile-based walkability
  
  // Content
  items: Item[]
  hazards: Hazard[]  // Husk nests, anomalies, decay traps
  storyHooks: StoryHook[]
  
  // Visual
  svgMesh: THREE.Mesh
  decayState: 0–1  // Affects lighting, SVG layer shown
}
```

#### 2.4 Room
```ts
interface Room {
  id: RoomID
  name: string
  position: {x: number, y: number}  // Building-relative grid coords
  size: {width: number, height: number}  // In tiles
  type: RoomType  // OFFICE | STORAGE | RADIO_STATION | SERVER_ROOM | ARCHIVE
  
  // Content
  items: Item[]
  hazards: Hazard[]
  interactables: Interactable[]
  
  // State
  exploredState: 0–1  // 0 = pristine, 1 = looted
  decayState: 0–1
}
```

**Procedural scope question:** How many zones per world?
- **Small:** 4–6 zones (tight, curated feel) → ~20–30 buildings total
- **Medium:** 8–12 zones (exploration incentive) → ~50–80 buildings
- **Large:** 16–20 zones (true open world) → 100–150+ buildings

**Memory constraint:** Each building is procedurally generated on-load (no pre-baked assets), so memory should scale gracefully. Each zone texture cache can be cleared when out of view range.

---

### 3. PLAYER & MOVEMENT (Phase 2A)
**Goal:** Walk the world with 8-directional sprite, collision system.

#### 3.1 Drifter
```ts
class Drifter {
  // Identity (randomized per run)
  id: DrifterID
  name: string
  origin: string  // e.g., "Bangladesh", "Thailand"
  appearance: DrifterAppearance  // Reuse WNCORE portrait pack (3 variants × 6 emotions)
  
  // State
  position: {x: number, y: number}
  facing: Direction  // N | NE | E | SE | S | SW | W | NW (8-directional)
  currentZone: ZoneID
  currentBuilding: BuildingID | null
  currentRoom: RoomID | null
  
  // Survival stats
  health: number  // 0–100
  signalStrength: number  // 0–100 (broadcast range)
  airQuality: number  // 0–100 (Fog of Medusa pressure)
  resourcesCarried: {items: Item[], weapons: Weapon[]}
  
  // Discovery state
  logbook: LogbookEntry[]
  evidenceChains: EvidenceChain[]  // Deduction progress
  
  // Permadeath tracking
  runID: RunID
  timeAlive: number  // Minutes since spawn
  
  methods:
    - move(direction: Direction, deltaTime)
    - interact(target: Interactable)
    - pickupItem(item: Item)
    - takeWeapon(weapon: Weapon)
    - getExtractionPath() -> Path[]  // Route to HQ
}
```

#### 3.2 Movement & Collision
```ts
class MovementController {
  drifter: Drifter
  speed: number = 3.0  // Units per second
  
  methods:
    - handleInput(keysPressed: Set<string>)
      // WASD → direction vector
    
    - move(deltaTime)
      // Apply velocity, check collisions
    
    - pointBlocked(x, y, radius?) -> boolean
      // Collision check against buildings, hazards
    
    - animateSprite(direction, isMoving)
      // Trigger 8-directional walk cycle
}
```

**Sprite animation:** Reuse existing isometric player sprite (from Mood Board section 4). Need to load 8 directional variants + idle/walk frames.

---

### 4. DISCOVERY & LOGBOOK (Phase 2B)
**Goal:** Find items, decode lore chains, build understanding.

#### 4.1 DiscoverySystem
```ts
class DiscoverySystem {
  logbook: Logbook
  evidence: Map<EvidenceID, Evidence>
  chains: EvidenceChain[]
  
  methods:
    - pickupItem(item: Item, drifter: Drifter)
      // Add to inventory → check for story hook trigger
    
    - unlockLogbookEntry(entry: LogbookEntry)
      // Mark as discovered, show in UI
    
    - checkChainCompletion(chain: EvidenceChain)
      // If all evidence collected → unlock deduction
    
    - getDeductions() -> Deduction[]
      // Narrative payoff (you write the text)
}
```

#### 4.2 LogbookEntry
```ts
interface LogbookEntry {
  id: EntryID
  type: EntryType  // ITEM | DOCUMENT | PHOTO | BROADCAST | DEDUCTION
  
  // Content (you write)
  title: string
  text: string
  timestamp: number  // When discovered
  
  // Tagging
  tags: string[]  // e.g., "SIGNAL", "HUSK_SIGHTING", "RELAY_STATION_7", "KESTREL-9"
  
  // Lore chains
  relatedEntries: EntryID[]
  chainID: EvidenceChain | null
  
  // Visual
  image?: string  // Base64 or path (use existing WNCORE asset icons)
  portraitEmotion?: string  // If dialogue-like
}
```

#### 4.3 EvidenceChain
```ts
interface EvidenceChain {
  id: ChainID
  name: string  // e.g., "KESTREL-9 Signal Loss"
  
  required: EntryID[]  // Must collect all to unlock deduction
  deduction: Deduction  // Narrative reward
  
  progress: number  // 0–1, for UI
}
```

**Content:** You write the logbook entries. RNG distributes them via `StoryHook` placement.

---

### 5. HAZARDS & SURVIVAL (Phase 2C)
**Goal:** Pressure, danger, time limit.

#### 5.1 HazardSystem
```ts
class HazardSystem {
  activeHazards: Hazard[]
  
  methods:
    - spawn(hazardType: HazardType, zoneID: ZoneID)
    
    - update(deltaTime, drifter: Drifter)
      // Check proximity, trigger damage, environmental decay
    
    - checkCollision(drifter: Drifter) -> Damage | null
}
```

#### 5.2 Hazard Types
```ts
type HazardType = 
  | 'HUSK_NEST'         // Zombie spawner
  | 'FOG_POCKET'        // Fog of Medusa localized intensity
  | 'SIGNAL_DEAD_ZONE'  // Radio blackout area
  | 'STRUCTURAL_DECAY'  // Collapsing building sections
  | 'ACID_RAIN_ZONE'    // Environmental damage
  | 'ANOMALY'           // Reality distortion (Cogito-style, Another Sky lore)

interface Hazard {
  id: HazardID
  type: HazardType
  position: {x, y}
  radius: number
  intensity: number  // 0–1
  
  // Time-based escalation
  spawnTime: number
  maxIntensity: number
  rampSpeed: number
  
  methods:
    - applyDamage(drifter: Drifter, deltaTime)
    - getVisualOverlay() -> THREE.Mesh  // Fog color, corruption distortion
}
```

#### 5.3 Survival Mechanics
- **Signal Strength decay** — every minute away from relay tower/broadcast point → −1 signal. At 0, game over.
- **Air Quality** — Fog of Medusa (yellow gas) reduces air quality near anomalies. Too low → hallucinations/stat debuffs.
- **Health** — Husk encounters, environmental damage, decay zone exposure.
- **Time pressure** — Perma-limit (e.g., "escape within 60 minutes or signal collapses") or soft pressure (resources deplete, hazards escalate).

**Question:** Hard time limit or resource-based soft pressure? (Permadeath plan doesn't specify.)

---

### 6. INTERACTION & EXTRACTION (Phase 3A)
**Goal:** Pick up items, enter buildings, find exit to HQ.

#### 6.1 InteractionSystem
```ts
class InteractionSystem {
  drifter: Drifter
  interactables: Interactable[]
  
  methods:
    - findNearby(radius?) -> Interactable[]
    
    - interact(target: Interactable, drifter: Drifter)
      // E-key press → pickup, enter building, investigate anomaly
    
    - showPrompt(target: Interactable, distance: number)
      // "E to examine" indicator
}
```

#### 6.2 Interactable
```ts
interface Interactable {
  id: InteractableID
  type: InteractableType  // ITEM | DOOR | ANOMALY | HQ_ENTRANCE
  position: {x, y}
  
  // Content
  linkedItem?: Item
  linkedRoom?: RoomID
  linkedStoryHook?: StoryHook
  
  // State
  investigated: boolean
  
  methods:
    - onInteract(drifter: Drifter)
}
```

#### 6.3 Extraction
```ts
class ExtractionSystem {
  hqPosition: {x, y}  // Fixed world position
  extractionRadius: number = 2.0
  
  methods:
    - canExtract(drifter: Drifter) -> boolean
      // Must reach HQ + alive
    
    - extract(drifter: Drifter, resourcesCollected: Item[])
      // Add items to vault, end run, show summary
    
    - getPathToHQ(drifterPos) -> Path[]
      // Pathfinding hint (no quest marker, just data)
}
```

---

### 7. SAVE & PROGRESSION (Phase 3B)
**Goal:** Permadeath mechanics, vault system, run log.

#### 7.1 RunManager
```ts
class RunManager {
  currentRun: Run
  runVault: Item[]  // Items successfully extracted
  runLog: RunSummary[]
  
  methods:
    - startNewRun()
      // Spawn new Drifter, new world seed, new time period
    
    - endRun(success: boolean, resourcesExtracted: Item[])
      // On death or extraction
    
    - saveRunLog(summary: RunSummary)
      // localStorage: `drifter-vault`, `drifter-runlog`
    
    - getVaultItems() -> Item[]
      // Resources to distribute to next Drifter
}
```

#### 7.2 Run
```ts
interface Run {
  id: RunID
  drifter: Drifter
  startTime: number
  endTime: number | null
  worldSeed: number
  worldTimeOfDay: number  // What "time" is this run set in?
  
  resourcesCollected: Item[]
  logbookFinal: LogbookEntry[]
  deductionsMade: Deduction[]
  
  status: 'ACTIVE' | 'SUCCESS' | 'DEATH'
  causeOfDeath?: string
}
```

**Permadeath rules:**
- Only resources successfully extracted to HQ persist to next run.
- Logbook entries + deductions are per-run, not persistent (you discover them anew).
- World seed changes per run (but can be seeded by difficulty/era).
- Each Drifter is new; personality/traits don't carry over.

---

### 8. UI & FEEDBACK (Phase 3C)
**Goal:** Minimal but informative logbook, broadcast, status.

#### 8.1 UIManager
```ts
class UIManager {
  logbookPanel: LogbookPanel
  broadcastPanel: BroadcastPanel
  statusBar: StatusBar
  
  methods:
    - toggleLogbook()
    - updateSignalStrength(value)
    - updateAirQuality(value)
    - playBroadcastLine(text, emotion?)
    - showDiscovery(entry: LogbookEntry)
    - showDeathScreen(cause: string)
}
```

#### 8.2 LogbookPanel
```ts
// Tabs: DISCOVERIES | BROADCASTS | NOTES | ARTIFACTS | MAP
// Similar to navigator.html, but survival-focused
// Uses existing WNCORE color scheme + portraits

interface LogbookPanel {
  entries: LogbookEntry[]
  currentTab: TabType
  
  methods:
    - addEntry(entry: LogbookEntry)
    - renderEntries()
    - updateProgress(chainID, progress: 0–1)
}
```

**Visual:** Canvas overlay + HTML UI. Keep it minimal (fits Octopath aesthetic).

---

## PROCEDURAL GENERATION STRATEGY

### World Size Estimation
```
Per zone:
  - Size: 512×512 world units (visible in ~30–50 seconds walk)
  - Buildings: 8–12 per zone
  - Rooms per building: 4–8 average
  - Items per room: 2–5
  - Hazards: 3–5 per zone

Per world (Medium scope):
  - 12 zones (4×3 grid)
  - ~100–120 buildings
  - ~600–800 rooms
  - ~1500–2500 items (pooled, not all loaded)
  - ~50–60 hazards (spawned dynamically)
```

**Memory footprint per zone:**
- Building meshes (SVG → texture → geometry): ~2–5MB
- Collision grid: ~50KB
- Hazard data: ~100KB
- Story hooks + items: ~200KB
- **Total per zone: ~3–6MB (manageable)**

**Loading strategy:**
- Preload current + adjacent zones only
- Unload zones far from player
- Stream assets on demand

---

## ASSET PIPELINE

### 1. ASSET FOLDER STRUCTURE

```
drifter/
├── src/                          [code — already scaffolded]
│
├── assets/
│   ├── characters/
│   │   ├── drifter/
│   │   │   ├── base/                  8-directional idle + walk cycles (sourced/drawn)
│   │   │   │   ├── idle_n.png ... idle_nw.png      (8 files)
│   │   │   │   └── walk_n.png ... walk_nw.png      (8 spritesheets, 4–6 frames each)
│   │   │   ├── variants/              palette-swapped or accessory variants per run (permadeath identity)
│   │   │   │   ├── variant_01.png
│   │   │   │   └── ...
│   │   │   └── portraits/             reused from WNCORE handler/drifter packs (already on disk)
│   │   │
│   │   └── husks/
│   │       ├── isometric/             NEW — need isometric-angle versions (current ones are side-view, unusable)
│   │       │   ├── shambler/
│   │       │   ├── sprinter/
│   │       │   └── bloated/
│   │       └── silhouettes/           placeholder — simple shape+color fallback until isometric sprites exist
│   │
│   ├── tiles/                    reuse existing isometric tile set (already audited, 36 variants)
│   │   ├── ground/                grass/sand/dirt/water (existing)
│   │   ├── road/
│   │   └── rubble/                 NEW — decayed/collapsed variants for high-decay zones
│   │
│   ├── buildings/
│   │   ├── templates/             reference art ONLY — not loaded at runtime, guides SVGBuildingFactory
│   │   │   ├── residential_ref.png
│   │   │   ├── industrial_ref.png
│   │   │   └── signal_tower_ref.png
│   │   └── generated_cache/       (gitignored) runtime SVG→texture bake output, for debugging/inspection
│   │
│   ├── props/
│   │   ├── relay_tower.svg
│   │   ├── fence.svg
│   │   ├── gate.svg
│   │   ├── vehicle_wreck.svg
│   │   ├── crate_barrel.svg
│   │   ├── warning_sign.svg
│   │   ├── road_sign.svg
│   │   ├── utility_pole.svg
│   │   └── lamp_post.svg
│   │   (these are the SVG source files SVGPropFactory composes from — mood board section 2 assets)
│   │
│   ├── items/                     reuse WNCORE icon set (existing, ~100 icons)
│   ├── weapons/                   reuse WNCORE weapon icon set (existing)
│   │
│   ├── ui/
│   │   ├── logbook/                panel chrome, tab icons (reuse WNCORE UI style)
│   │   ├── hud/                    signal strength bar, health, air quality icons
│   │   └── fonts/                  pixel/monospace font files for VN-style text
│   │
│   ├── audio/
│   │   ├── music/
│   │   │   ├── ambient/             per-zone-type loops (residential_drift.ogg, industrial_hum.ogg, signal_hub_static.ogg)
│   │   │   ├── tension/              hazard-proximity stingers/loops
│   │   │   └── extraction/           HQ-safe theme, success/death stings
│   │   ├── sfx/
│   │   │   ├── footsteps/            per-tile-type (grass, road, rubble, water)
│   │   │   ├── ui/                   logbook open/close, discovery chime, pickup
│   │   │   ├── hazard/                husk groan, fog hiss, anomaly warp sound, structural creak
│   │   │   └── radio/                broadcast static, signal drop, tuning
│   │   └── voice/                    (future — Drifter ambient lines, if voiced)
│   │
│   └── fx/
│       ├── particles/                dust mote textures, ash, debris sprites for DustParticles
│       └── noise/                    seamless noise textures (god-ray scroll, fog grain, anomaly displacement maps)
│
├── package.json
├── tsconfig.json
└── .gitignore                       (generated_cache/ and dist/ excluded)
```

**Reuse-from-WNCORE checklist** (already on disk, just needs copying into `drifter/assets/`):
- Portrait packs (handler + drifter SWAT variants)
- Item icon set (~100 icons)
- Weapon icon set
- Isometric tile set (36 variants, 256×128/128×88)
- WCP parallax silhouette layers (could inform distant-skyline backdrop behind the sky dome)

**Net-new asset needs** (flagged earlier, now organized):
- 8-directional Drifter walk/idle sprites (top-down `drifter/Idle.png` etc. on disk are side-view, wrong angle — need isometric-specific set)
- Isometric husk sprites (current ones are side-view spritesheets, same problem)
- Music — entirely new, none exists yet for DRIFTER specifically
- SFX — entirely new
- Prop SVGs — can be authored directly as code/SVG (no external sourcing needed, matches SVGPropFactory approach)

---

## FIRST WORKABLE MAP — SCOPE & PLAN

Goal: not a tech demo — an actual **walkable, atmospheric, single-zone slice** that exercises every system built so far (WorldGenerator → SVG bake → IsometricRenderer → SkySystem → Atmosphere presets → basic interaction). This is the "does it feel like Another Sky" checkpoint before scaling to the full procedural world.

### Scope (deliberately small, deliberately complete)

**One zone. One building. Real stakes-free walk.**

- **Zone:** `RURAL_RELAY` type — directly matches the mood board's Relay Station 7 reference. Single zone, no streaming needed yet (defer `ZoneStreamer` until multi-zone phase).
- **Buildings:** 1 main structure (the relay station itself — radio terminal + maintenance shed, matches mood board) + 2–3 small props-only set pieces (fence line, relay tower, road sign) — no second full building yet.
- **Rooms:** 2 interior rooms in the main building (radio terminal room + storage room) — enough to prove room-level item placement and the room→building→zone hierarchy without overbuilding.
- **Items:** 5–8 hand-placed (not RNG-distributed yet) — including 1 logbook discovery item to prove the DiscoverySystem hookup end to end.
- **Hazards:** 1 only — a `FOG_POCKET` near the relay tower base, just enough to prove `HazardSystem` + the `fog_of_medusa` atmosphere preset reacting to real zone data together.
- **No husks yet** — defer combat/AI entirely; this map is about proving environment + atmosphere + discovery, not survival pressure.
- **HQ/extraction:** the bus visible in the mood board reference — parked at the road, functions as the extraction point. Reaching it ends the test "run."

This scope is intentionally narrow so it's buildable in days, not weeks, and every piece directly maps to a mood board element you've already approved the look of.

### Build sequence for the first map

| Step | What gets built | Depends on |
|---|---|---|
| M1 | Hand-author `relay_station.json` — a hard-coded `Zone`/`Building`/`Room` data object matching `types.ts` schema (bypass `WorldGenerator` RNG entirely for this first map — known-good data, not procedural, so bugs are isolated to rendering/logic, not generation randomness) | `types.ts` (done) |
| M2 | `SkySystem` + `PixelPipeline` rendering empty isometric scene at dusk (23:47, per mood board's "RS7 — DAY 9, 23:47" timestamp) | Rendering deep-dive §2.1–2.2 |
| M3 | `SVGBuildingFactory` generates the relay station + maintenance shed using the mood board reference as the template target (not abstract procedural — this specific building gets hand-tuned as the template's "type 1" reference) | Rendering deep-dive §3, §2.5 |
| M4 | Bake via `SVGRasterizer`, place in scene, `LightingController` + `GodRayLayer` lit from one warm window-glow sun-equivalent (relay station windows ARE the practical lights here, per mood board — may need point-lights at window positions in addition to the single "sun," since this is a night scene and the windows are the dominant light source) | Rendering deep-dive §6, §2.6 |
| M5 | Props: relay tower, fence, road sign, lamp post — `SVGPropFactory`, placed per mood board layout | Rendering deep-dive §3 |
| M6 | `fog_of_medusa` atmosphere preset active at low intensity near the tower base hazard — CSS overlay layer | Rendering deep-dive §8.5 |
| M7 | Drifter spawns on the road, 8-directional movement + collision against the building/fence | Phase 3 (Drifter, MovementController — pulled forward just enough for this map) |
| M8 | Walk into relay station, pick up the one logbook item, `DiscoverySystem` fires, logbook UI shows the entry | Phase 3 (DiscoverySystem, UIManager — minimal version) |
| M9 | Walk to the bus, extraction triggers, simple "RUN COMPLETE" screen | Phase 3 (ExtractionSystem — minimal version) |
| M10 | Ambient audio loop (`industrial_hum.ogg` or a new `relay_night.ogg`) + 1 discovery chime SFX wired in | Audio assets (net-new, above) |

**Why a hand-authored map first, not procedural:** Steps M1–M10 prove the *entire vertical slice* — rendering, atmosphere, discovery, extraction — using known, fixed data. Once this map feels right (lighting matches mood board, atmosphere reacts correctly, discovery loop is satisfying), `WorldGenerator`'s procedural output gets fed into the *exact same* rendering/gameplay pipeline with zero changes to those systems — only the data source changes from `relay_station.json` to `WorldGenerator.generate()`. This isolates "does the engine work" from "does the procedural generation produce good layouts," which are genuinely separate questions and shouldn't be debugged simultaneously.

### Definition of done for the first map

- [ ] Scene at night visually reads as "Relay Station 7" — warm window light, dark sky, fog pocket visible near tower
- [ ] Drifter walks in 8 directions, collides with building walls and fence correctly
- [ ] Entering the relay station transitions to interior rendering (room-level view — even if visually simple at first, just needs to swap context correctly)
- [ ] Picking up the logbook item adds a real entry to a visible (even if minimal) logbook panel
- [ ] Standing near the fog pocket measurably affects `airQuality` or triggers the `fog_of_medusa` CSS preset visibly
- [ ] Reaching the bus ends the session with a clear, simple completion state
- [ ] One ambient music loop plays throughout, one SFX fires on discovery

That's the bar. Once hit, the next milestone is swapping `relay_station.json` for real `WorldGenerator` output and scaling to multiple zones via `ZoneStreamer`.

**Deliberately deferred from this first map:** husk AI/combat, multi-zone streaming, procedural story-hook distribution, run/permadeath persistence — all come after this slice proves out, per the phase plan below.

---

## DEVELOPMENT PHASES

### PHASE 1 (Weeks 1–2): Rendering Foundation
- [ ] Three.js setup + isometric camera
- [ ] SkySystem (time-of-day, weather, corruption overlay)
- [ ] BuildingSVGGenerator (procedural silhouettes + decay)
- [ ] WorldGenerator (zone + building placement)
- [ ] Proof-of-concept: Render one zone with procedural buildings
- [ ] **Deliverable:** Static scene matching Mood Board Relay Station aesthetic

### PHASE 2 (Weeks 3–4): Gameplay Loop
- [ ] Drifter spawning + 8-directional sprite animation
- [ ] MovementController + collision
- [ ] Basic HazardSystem (Fog of Medusa, structural decay)
- [ ] InteractionSystem (pickup items, enter buildings)
- [ ] DiscoverySystem + Logbook (pick up entries, show in UI)
- [ ] **Deliverable:** Walk around, collect items, build logbook

### PHASE 3 (Weeks 5–6): Survival & Extraction
- [ ] Survival stats (signal, air quality, health)
- [ ] Husk spawning + simple AI (avoid, chase)
- [ ] Extraction mechanic (reach HQ, return with items)
- [ ] RunManager + permadeath
- [ ] Death screen + run log
- [ ] **Deliverable:** Full loop — spawn, explore, extract or die

### PHASE 4 (Weeks 7–8): Polish & Content
- [ ] Story hooks distribution (you provide logbook entries)
- [ ] Evidence chains + deductions
- [ ] UI refinement (logbook styling, broadcast panel)
- [ ] Audio (ambient loops, discovery chimes, corruption sound effects)
- [ ] Difficulty scaling + world variance
- [ ] **Deliverable:** Shippable build with compelling first run

---

## NEXT IMMEDIATE STEP (Now)

**Status:** Phase 1 (data foundation) fully verified working in Codespaces — see handoff block at top of doc. Phase 2 (rendering) has zero files written.

**Open decision (pick one to resume):**

**Option A — M1 first:** Hand-author `relay_station.json` against `types.ts` schema (no rendering code needed, pure data sanity-check, matches mood board Relay Station 7 night scene).

**Option B — Rendering first:** Jump to Rendering Deep-Dive step 2.1 (`SkySystem` standalone, gradient dome + time cycle) + 2.2 (`IsometricRenderer`/`PixelPipeline`, empty scene, low-res nearest-neighbor upscale) to get something actually visible in the browser before any building/content data exists.

Leaning B for momentum (visible progress in Codespaces beats more JSON), but confirm with Siharu before writing code.

### Content — Your Job
- **Story hooks:** Write 20–40 logbook entries (titles + text). Specify which zone/building/room they appear in (or leave placement to RNG, once past the first map).
- **Evidence chains:** Define 3–5 deduction chains (e.g., "KESTREL-9 Signal Loss" chain needs these 5 items → unlocks this narrative payoff).
- **Difficulty flavor:** If world gen should reflect different time periods / eras of decay, provide thematic context per zone.
- **First map's one discovery item:** just needs 1 logbook entry written to satisfy M8 — small ask to unblock the whole vertical slice.

---

## OPEN QUESTIONS

1. **Hard time limit or soft pressure?** ("Extract within 60 min" vs. "resources deplete, hazards escalate")
2. **Husk behavior complexity?** (Simple patrol/aggro, or more sophisticated AI?)
3. **World size preference?** (Small 4–6 zones, Medium 12 zones, or Large 16+?)
4. **Story scope?** (How many logbook entries do you want to write for launch?)
5. **Difficulty settings?** (Should world gen seed difficulty levels?)

---

## FILE STRUCTURE (Final)

```
drifter.html (main single-file entry)
  <style> — minimal CSS (CRT scanlines, UI)
  <canvas id="game-canvas" width="640" height="480">
  <div id="ui-overlay"> — logbook, broadcast, status
  
  <script>
    // ── Core classes ──
    class IsometricRenderer { }
    class SkySystem { }
    class BuildingSVGGenerator { }
    class WorldGenerator { }
    class Drifter { }
    class MovementController { }
    class DiscoverySystem { }
    class HazardSystem { }
    class InteractionSystem { }
    class ExtractionSystem { }
    class RunManager { }
    class UIManager { }
    
    // ── Main loop ──
    function gameLoop(deltaTime) { }
    
    // ── Init ──
    async function init() { }
    window.addEventListener('DOMContentLoaded', init)
  </script>
</html>
```

Keep it **self-contained** — no external bundler, no npm deps beyond Three.js CDN.

extra thoughts 
THE ENGINE ORGANIZED BY LOOP PHASE, NOT BY SYSTEM TYPE
Most game engines organize by system (MovementSystem, CombatSystem, InventorySystem). That works when systems are roughly equal citizens. In DRIFTER they're not — three phases have completely different active systems, and organizing around phases makes the code reflect the actual experience rather than a generic blueprint:
Phase 1 — PRE-RUN (HQ)
  RunManager spawns or pulls Drifter from roster
  Inventory pre-loaded (bat/crowbar, starting rations)
  World seed locked, WorldGenerator runs
  AtmosphereController set to HQ preset (safe, warm)

Phase 2 — EXPLORATION (the actual game)
  ThreatModel (detection, noise, line-of-sight) — the real engine heart
  MovementController (WASD, collision, noise generation)
  CatalogSystem (observe → catalog from distance, or pickup → inspect)
  HuskSystem (patrol AI, escalation states, taxonomy tracking)
  InventorySystem (carry weight, consumables, currency origin)
  WorldInfoLayer (read past-Drifter deposits, write new ones)

Phase 3 — RESOLUTION (extract or die)
  RunManager closes the run
  Survivors enter the roster pool
  Vault persists extracted items
  WorldInfoLayer deposits survive to next run's world
The phases are a state machine, not a flat loop. RunManager owns transitions between them. Each phase activates/deactivates systems rather than all systems running all the time.

THE THREAT MODEL IS THE HEART
Everything else in Phase 2 hangs off this. If it's shallow, the whole loop is shallow. Proposed:
ThreatModel
├── perHusk detection radius (varies by HuskType once named/discovered)
├── player noiseLevel (walk=low, run=high, interact=spike, attack=high)
├── lineOfSight (ray from husk toward player, blocked by Building geometry)
└── per-husk state machine:
    PATROL → ALERTED (heard noise) → INVESTIGATING (moving toward source)
    → SPOTTED (has LOS) → PURSUING → ATTACKING
    → LOST (lost LOS for N seconds) → PATROL
Two things make this interesting rather than just a detection radius:

Noise spikes on interaction — cataloging a husk from far away is silent. Picking up an item makes a small noise. Using the crowbar on a door makes a big noise. This creates real cost-benefit tension on every action.
Most Drifters have no attack state — if a husk reaches ATTACKING, the Drifter's only options are flee or die. Special recruits unlock ENGAGE as an option, but it's still not free (number/type of husks matters).


CATALOG SYSTEM — THE DISCOVERY ENGINE
This is what makes runs feel meaningful beyond just survival. Four types, each with different data shapes:
CatalogEntry {
  type: SURVIVAL_KNOWLEDGE | SAFE_ZONE | CAMP_LOCATION | HUSK_INTEL
  drifterID: who logged it (for variance tracking)
  itemSeed: hash(drifterID + itemTypeID) → which fact pool slice this Drifter sees
  content: string (generated from fact pool, seeded per-Drifter)
  worldPosition?: Vector2 (for SAFE_ZONE/CAMP_LOCATION types — actual coords)
  huskType?: string (for HUSK_INTEL — null until discovered/named)
  runID: which run produced this
}
Per-Drifter variance implementation: each item type has a fact pool (array of possible observations). hash(drifterSeed + itemTypeID) picks a starting index and stride, so the same Drifter always sees the same facts for that item (consistent within a run) but different from another Drifter. The "no repeats" constraint from the chatlog = the exclusion set is per-drifter-career, not global.

HUSK TAXONOMY — PROGRESSIVE UNLOCK
Husks start nameless. The engine tracks them only by a generated silhouette ID. Discovery unlocks happen in order:
HuskRecord {
  internalID: string          // always exists
  discoveredName: string | null   // null until first observation catalog logged
  variants: string[]          // empty until enough encounters logged
  weaknesses: string[]        // empty until special-recruit sample collected
  encounterCount: number      // tracked across all runs in this career
}
HuskSystem spawns by internalID. CatalogSystem writes to HuskRecord on each observation. Once discoveredName exists, the UI starts showing the actual name. This is data, not code — the taxonomy unlocks itself through play.

WORLD INFO LAYER — CROSS-RUN PERSISTENCE
This is the "Drifters leave notes for each other" system. Separate from the Logbook (which is the player's current-run catalog). Lives in localStorage, persists across runs:
WorldInfoDeposit {
  drifterName: string
  position: Vector2
  zoneType: ZoneType        // so RNG can place deposits in matching zone types
  type: CatalogEntry type   // what kind of note was left
  content: string
  runID: string
  ageInRuns: number         // increments each run, deposits fade/disappear after N runs
}
Max 4 deposits per Drifter per run (already locked). New runs pull deposits from the pool and scatter them into matching zone types — so a deposit from a rural relay zone shows up in rural relay zones in future runs, not randomly anywhere.

DRIFTER GENERATION — THE ROSTER SYSTEM
DrifterRecord {
  id: DrifterID
  name: string
  origin: string            // country of origin (affects which currency is "home")
  backgroundType: AVERAGE_RECRUIT | SELECTIVE_RECRUIT
  fightKnowledge: number    // 0 (no combat) to 1 (special recruit)
  catalogBonus: CatalogType[] // which catalog types this Drifter produces richer entries for
  survived: boolean
  runsCompleted: number
}

DrifterRoster {
  pool: DrifterRecord[]     // grows each time a Drifter extracts alive
  generate(): DrifterRecord  // weighted: 80% fresh, 20% pull from pool if pool exists
}
Special recruits are not a separate spawn — they're the top tail of fightKnowledge distribution, weighted rare. Their catalog bonus also makes them more valuable alive than dead (better intel entries), creating real extraction pressure.

FILE STRUCTURE (Phase 3)
src/
├── gameplay/
│   ├── RunManager.ts           — phase state machine, Drifter lifecycle
│   ├── DrifterEntity.ts        — player entity, stats, loadout
│   ├── DrifterRoster.ts        — survivor pool, generation, weighted spawn
│   ├── ThreatModel.ts          — detection, noise, LOS, husk state machine
│   ├── MovementController.ts   — WASD, collision against IsoTileMap
│   ├── CatalogSystem.ts        — 4 types, per-Drifter variance, fact pools
│   ├── HuskSystem.ts           — spawn, patrol AI, taxonomy records
│   ├── InventorySystem.ts      — items, weapons, consumables, currency
│   ├── WorldInfoLayer.ts       — cross-run deposit read/write, localStorage
│   └── InteractionSystem.ts    — proximity detection, E-key, item pickup
├── data/
│   ├── relay_station.json      — M1 hand-authored first map
│   ├── fact_pools.ts           — per-item-type fact arrays (you write the text)
│   └── husk_records.ts         — initial empty taxonomy (fills through play)
└── render/                     — already complete

BUILD ORDER FOR PHASE 3
StepWhatWhy firstP1relay_station.jsonReal data to test everything against — nothing else works without a real mapP2DrifterRoster.ts + DrifterEntity.tsThe player needs to exist before movement/threat makes senseP3MovementController.tsWalking the world is the first visible proof the game feels rightP4ThreatModel.ts (detection only, no AI yet)Husk detection radius proves the core tension without full AIP5InteractionSystem.ts + CatalogSystem.ts (basic)The discovery verb — this is what makes exploration feel purposefulP6HuskSystem.ts (patrol + escalation)Add the threat that makes cataloging feel dangerousP7InventorySystem.tsItems, consumables, currency origin trackingP8WorldInfoLayer.tsCross-run deposits — last because it needs real runs to generate contentP9RunManager.tsCloses the loop, permadeath, roster persistence
THREAT HIERARCHY (from bible, confirmed):
Husks (9 types) → transformed humans who rejected reality. Not infected, not undead. Each type is a different psychological rejection manifesting physically:

Skoth — early/unstable, decomposing by 9 months. Low threat, rare later
Glowbubs — fixated on light sources, flee to nearest one. Predictable patrol
Jawies — aggressive, ram/break barriers, muscular. High physical danger
Whites — detect vibration from kilometers away, white hair, calcified fingers. Stealth is mandatory around these
Oldbones — elderly, restructured skeleton, hardened head/spine. Resistant to conventional stopping
Disabled — compensatory senses (blind = hyperhearing, deaf = extreme sight, crippled = mutated limbs). Unpredictable detection
Noire — nocturnal, travel in 2-3 groups, slight hive-mind, completely still until movement detected. Night gameplay is fundamentally different
Bloaters — screams cascade nearby Husks. One can turn a manageable situation catastrophic instantly
Aquatic — underwater, months into outbreak. Certain zones become inaccessible

Infected (partial rejection, can think/talk/plan/infiltrate) are separate and more dangerous intellectually than Husks. Ghuuls (173 worldwide) are the apex threat — near-unkillable, retain agency and emotion, glitch between realities.
FACTIONS IN THE WORLD:

WNCORE — radio network, global news/Ghuul tracking. The HQ the Drifter returns to is a WNCORE relay station
Logbook Drifters — unknown number, owl-and-lizard logo, mass-produce and distribute logbooks globally. Counter-Drifter faction plants fake ones — this is a real gameplay mechanic (fake logbook deposits in WorldInfoLayer)
Blood Pact — criminal syndicate, Antarctica, organ smuggling
Remaining Governments — Alaska stronghold, secretly planning to nuke everything
Moon Dwellers — elites in Moon Dome, unknown status
Rooftop Seers — secretly infected, still broadcasting
White Flag — pacifist aid, cruise ship near London
Pale Node — scientists, ambiguous goals
Kraken's Paw — fishermen/oil workers, Southern Pacific

WORLD ANOMALIES that affect gameplay:

Rain of Obsedia — black rain, nearly blocks sun, calms Infected (massive gameplay implication — Obsedia Rain = temporary safe window around Infected), makes Ghuuls briefly human-like
Fog of Medusa — yellow gas, Germany only, kills organic life. Husks unaffected, Infected die in it
Global Chilling — hail 5-6 times monthly
Great Migration — trillions of insects/animals moving north. Unknown cause/destination

Regional naming matters for currency system:

Bangla: Mora/Dhar (husks), Bhromito/Monkharap (infected), Shada Bhuture (ghuuls)
Japanese: Yurei, Kowai Hito, Shiro Oni
US slang: Meatbags/Screamers, Freaks/Echoes, Snow Demons
Hindi: Murda/Shaitan, Pagal/Bhatki Aatma, Safed Pret
Filipino: Multo/Bangkay, Naliligaw/Mga Sirang, Puting Halimaw


What this changes in the game data:
Three things need to go into the engine now before relay_station.json:

src/data/husk_records.ts — all 9 Husks with their real bible-accurate traits, behavior, detection types (vibration/sight/hearing/nocturnal/etc.) as starting HuskRecord objects with discoveredName: null (the game fills these in through play, but the internal data is accurate from the start)
src/data/fact_pools.ts — catalog entries sourced from bible lore, not made-up placeholder text. "What does a Drifter notice when they pick up a political book in Bangladesh?" should reference Blank Zone, WW3, the currency situation, regional naming for threats
relay_station.json — a WNCORE relay station (not just any building), set in Bangladesh region to match the game's origin, with Fog of Medusa absent (Germany only), Rain of Obsedia possible (global), Noire Husks appropriate for a night scene (23:47 per mood board)
Critical note. That changes how everything in the game-facing data is written.
What Drifters actually know in 2032:

Unknown pathogen, possibly viral
Bite transmission (observed)
In-world theories: signal-based brain rewiring, prion disease, undiscovered virus, fungus in bloodstream, drug hallucinations
Behavioral observations only — what they do, not why

What never appears in catalog entries, logbooks, or any player-facing text:

"They rejected reality"
"Psychological response to truth"
"The veil"
"Dimensional exposure"
Anything connecting Husks to the Blank Zone philosophically

So husk_records.ts and fact_pools.ts need to be written entirely from a scared survivor's observational perspective. A Drifter cataloging a White doesn't write "sensory overload rejection manifesting as hypervigilance" — they write "white hair, calcified fingers, detected me from 400m, no sound made, movement only — stay completely still."
The in-world theories section of the bible is actually what the catalog entries should reference when Drifters speculate — signal rewiring, prion disease, fungus, unknown virus. That's the player-facing truth layer.
The real truth bleeds in only through the sky progression and anomalies, never explicitly stated. Exactly as it should be.