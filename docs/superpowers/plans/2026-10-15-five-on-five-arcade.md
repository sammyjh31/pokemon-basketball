# Five-on-five arcade implementation plan

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development. Track completed steps here. The user approved the spec and explicitly requested building the mode; proceed through implementation and verification in this session.

**Goal:** Deliver a directly playable five-on-five exhibition using the existing eight-player Pokémon rosters.
**Architecture:** A deterministic fixed-step spatial engine owns basketball. Canvas reads world state; React owns setup, HUD, controls, pause, bench, and results. Existing season and playoff data are read-only inputs.
**Tech Stack:** Existing TypeScript, React, Vite, Canvas 2D, Web Audio, Vitest. Node >=24.15.0; no new runtime dependencies.
**Spec:** `docs/superpowers/specs/2026-10-15-five-on-five-arcade-design.md`

## Global constraints
- Exactly five active players and three reserves per side; four 60-second quarters, repeated 30-second overtime, 14-second possession clock.
- Keyboard and touch; focus loss pauses; no season or playoff persistence changes.
- Existing Pokémon ratings and locally bundled sprites; seeded action outcomes.
- Shared workspace has concurrent playoff work. Implement on `codex/five-on-five-arcade`; reconcile integration only after validation.

## Review focus
1. A clock expiring with a legal shot in flight must resolve once without a phantom rebound or extra playing time (engine scenarios).
2. Pausing while shooting or cancelling a pointer must not leave held input or release an involuntary shot (input tests and browser).
3. Simultaneous substitution requests must preserve five distinct active players and the original roster (engine scenarios).
4. Missing sprites, unavailable storage/audio, or resizing must preserve a usable game (renderer fallback and browser).
5. An existing completed season must survive arcade entry, rematch, and exit (integration test and browser).

## Shared interfaces
`createGame(setup: ArcadeSetup): ArcadeState`; `stepGame(state: ArcadeState, input: ArcadeInput, dt = 1/60): void`; `setPaused(state, paused): void`; `continuePeriod(state): void`; `queueSubstitution(state, outId, inId): boolean`; `cancelSubstitution(state, outId): void`.
`ArcadeState` and related types are in `src/game/arcade/types.ts`. Player IDs are array indices, separate from Pokémon IDs. Team side is 0 or 1. State is mutated only by the engine; React receives cloned/throttled snapshots. Render functions read the live state without changing it.
Renderer API: `loadArcadeAssets(ids: number[]): Promise<Map<number, HTMLImageElement>>`; `drawArcade(ctx, state, assets, width, height, reducedMotion): void`.
Engine helper exports: `activePlayers(state, team?)`, `attackDirection(state, team)`, `basket(state, team)`, `passTarget(state, player, input?)`, `playerOfGame(state)`.

## Initial tuning
Court 28 × 15 logical units, baskets (1.5,7.5)/(26.5,7.5). Player collision radius .42, pickup .85, dunk distance 2.5, three-point radius 6.75. Speed 3.5–5.5 units/sec by rating, turbo ×1.45, normalized diagonal movement; acceleration 16/sec. Shot charge ideal .65 sec, auto release at 1.2 sec; jump duration .65 sec. Pass travel 12–19 units/sec; shot flight .65–1.25 sec. Steal cooldown .8 sec; block cooldown .9 sec. Energy 0–100, turbo drain 16–23/sec, ordinary recovery 5/sec, bench 12/sec, quarter recovery 18; tired speed floor .8. Hot streak +.10 shooting probability and half turbo drain for ten live seconds after three unanswered team baskets. Shooting chance clamped .04–.95, driven by rating, release accuracy, distance, contest, energy. Steal chance .1–.7, driven by steals vs handling. CPU decisions every .2–.45 sec, uses identical action helpers.

### Task 1: World, contracts, and roster safety
- [x] Add failing `src/game/arcade/engine.test.ts` cases for valid 16-player initialization, invalid/incomplete/duplicate rosters, reproducibility, and setup immutability. Run focused Vitest and observe missing feature.
- [x] Implement types, tuning, setup and geometry helpers; validate IDs, all eight slots and global uniqueness. Initialize tipoff, clocks, energy and zero stats.
- [x] Run focused tests and typecheck.

### Task 2: Spatial basketball engine
- [x] Add scenario tests for movement, passing ownership, shooting events, pause, buzzer shots, possessions, overtime, and atomic substitutions before implementations.
- [x] Implement movement/contact, actions/ball flight, stats event recording, dead-ball/period state transitions, energy, hot streaks and substitutions in focused modules under `src/game/arcade/`.
- [x] Add spatial AI: spread roles, cut/fill, screen/roll, defensive matchups, loose-ball chase, CPU drives/passes/shots. Full seeded CPU game must finish with conserved scores and seconds.
- [x] Verify focused engine tests, including failure fixtures and repeated seeded full games.

### Task 3: Court rendering and audio (independent after contracts)
- [x] Implement `src/arcade/renderer.ts` and `audio.ts`: polished hardwood, court lines, baskets, team markers, depth-sorted sprites, action transforms, shadows, ball arcs, meter, messages and hot streak effects.
- [x] Implement asset preload with fallback and sound initialization after user interaction. Reduced motion suppresses decorative effects.
- [x] Verify projection/fallback behavior with focused tests where meaningful; inspect actual canvas in browser.

### Task 4: Controls, runtime, and menus (independent after contracts)
- [x] Add tests for keyboard edges, cancellation and pause; implement `src/arcade/input.ts` and `src/hooks/useArcade.ts` with bounded fixed steps, throttled snapshots, visibility/focus pausing, teardown and responsive canvas.
- [x] Implement `src/components/ArcadeMode.tsx` plus setup/pause/results/touch controls and `src/arcade.css`. Setup consumes `run: Run` and `onExit(): void`; reuses current league teams or `createLeague(run)` once.
- [x] Queue manual bench swaps, show CPU bench/energy, optional audio/effects, restart/opponent selection and both-team stats. Offer exit confirmation only for unfinished game.
- [x] Test menu flow, incomplete roster gating, substitutions and box-score arithmetic. Verify keyboard and touch in browser.

### Task 5: App integration and delivery
- [x] Add integration test proving Play arcade opens for a complete roster and exit preserves its saved season. Add small App entry/switch integration and README controls.
- [x] Run all tests, typecheck, build and whitespace checks using bundled Node 24.19.0.
- [x] Play actual browser match and inspect desktop/mobile/reduced motion, pausing, scoring, results, rematch and storage invariants. Record screenshots; visually inspect pacing and document measurement limits; fix findings.
- [x] Obtain independent review, resolve actionable findings, update this plan, and commit only arcade changes. Reconcile the latest committed playoff changes and deliver the isolated preview; leave the primary checkout untouched while franchise work is uncommitted.

## Delivery record

- Arcade committed on `codex/five-on-five-arcade` at `653592c`; merged committed playoff baseline `8a1257a` into the arcade branch. The primary checkout has active uncommitted franchise edits and was left untouched. This branch is ready for later integration after that work is committed.
- Final verification: **218 tests in 39 files passed**; `npm run typecheck`, `npm run build`, and `git diff --check` passed with bundled Node 24.19.0. Arcade is lazy-loaded; no new runtime dependencies.
- Browser: played through all four quarters to results, verified 20:00 team minutes, both box scores, fresh rematch, exit confirmation, and unchanged eight-player roster after reopening. Tested keyboard movement, passing, receiver selection, turbo, timed shot release, defense, pause/resume, touch movement/shooting, audio/reduced effects, manual bench swaps, halftime basket reversal, and a second opponent.
- Inspected 1280×720 desktop, 390×844 portrait, and 844×390 landscape. Fixed initial scroll position and short-window court sizing. No browser warning/error entries in the checked session. Physical-mobile performance and measured frame pacing remain unverified.
- Review fixes: stale shot charge after steals, reachable boundary calls, correct possession resets after rim contact, assist timing at release, once-per-pass interception checks, stable AI roles after substitutions, restored focus after removing `inert`, and cancellation of keyboard-held touch actions on blur. Playoff simulation now blocks arcade entry until the operation finishes.
- Screenshots: `docs/design/arcade-court-desktop.jpg`, `arcade-court-mobile.jpg`, `arcade-results-desktop.jpg`. Preview is running at `http://127.0.0.1:5179/`; open **Play arcade** and **Tip off**.
- Matches remain local exhibitions and are not saved. No deployment or remote push performed.

## Franchise integration — 2026-10-15

- User requested merging arcade into the main game while retaining franchise work. Merged franchise baseline `97217aa` into the arcade branch, retaining both App interfaces and all franchise simulation, reducer, persistence, and history files unchanged.
- Added regression tests before fixing roster selection: offseason arcade now reads current franchise teams after trades, and pregame arcade reuses persistent league teams. Both offseason and next-season tests require exactly unchanged save bytes and unchanged input state after entry and exit.
- Combined verification: **271 tests passed across 46 files**; TypeScript, production build, and whitespace checks passed. Independent integration review reported no actionable findings. The pre-existing main-chunk size advisory remains; arcade is lazy-loaded.
- Browser setup opens with the existing eight-player roster and CPU selection. Initial full-match browser QA remains recorded above.
- Integrate this verified tree into local main by fast-forward. New player-development edits appeared concurrently in the primary checkout; preserve those separate edits and do not include them in the arcade merge. No remote push requested.
