# Pokémon Matchup Engine Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Make Pokémon body and typing affect possession decisions and outcomes, with inspectable reasons.
**Architecture:** A pure matchup model supplies physical profiles, opportunity estimates, screen contests and resolved-action effects. The simulator, coaches and matchup explorer share it. A frozen version flag protects historical seeds.
**Tech Stack:** TypeScript, React, Vite, Vitest.
**Spec:** docs/superpowers/specs/2026-10-16-pokemon-matchup-engine.md

## Global Constraints
- Eight unique players per club; existing league uniqueness rules.
- No synthetic score bonuses; all points use existing basketball events.
- Catalog height/weight only; no invented anatomy. Bounded fictional basketball tuning.
- Old saved inputs replay byte-for-byte. Diagnostics do not consume RNG.
- Work in the managed worktree; integrate and push to main after verification, as already authorized.

## Review Focus
- Equal skills must expose body tradeoffs rather than merely reflecting rating differences (task 1).
- Kickouts must evaluate the new shooter and recovering defender, not the original post scorer (task 2).
- Mixed version saves must fail; old archive flags must not silently upgrade (task 3).
- Full versus compact result collection must return identical scores and boxes (task 2).
- Extreme heights/weights, fatigue, and type immunity must remain finite and defeatable (task 1).

### Task 1: Pure physical/type matchup model
- [x] Add failing tests for mass/post vs speed/perimeter tradeoffs, height contests, bounded extremes, type advantage/resistance, screen and fatigue effects.
- [x] Implement body profile, matchup edges, action evaluation, opportunity weighting and physical rebound adjustments in `src/game/bodyMatchups.ts`.
- [x] Run focused tests and record evidence.

### Task 2: Possession and coaching integration
- [x] Add failing integration tests for resolved advantages, physical/type shot evidence, accounting and replay invariance.
- [x] Add optional body profile to match players. Gate new play/recipient selection, defensive matchup scoring, screens, help, turnovers, fouls, contests, blocks, rebounds and fatigue on the new version.
- [x] Capture shot matchup evidence using the actual final participants. Replace overlapping old physical effects only on the new path.
- [x] Run simulation and coaching tests; compare historical games with main.

### Task 3: Save/version lifecycle
- [x] Add failing save/archive tests for new/old/mixed flags and standard franchise rollover.
- [x] Propagate `matchupVersion` through new runs, clubs, local leagues/careers, validation and archives.
- [x] Run relevant persistence and lifecycle tests.

### Task 4: Scouting and explanations
- [x] Add failing UI/model tests for matchup explanation and shared pregame preview.
- [x] Add a compact matchup report to game insights and a physical matchup view to the existing explorer; show type, size, screen/containment tradeoffs and conditional effects.
- [x] Verify no invented historical telemetry and responsive layout.

### Task 5: Verify and deliver
- [x] Audit multi-roster seeded simulations and controlled body/type changes; document coefficients and limitations.
- [x] Run build and full suite. Obtain independent whole-change review; repair material findings with regressions.
- [x] Browser-check on a separate origin without touching the user's save.
- [x] Commit and push local main, verify the remote, and leave the game running from the attached worktree while the primary checkout is used for another branch.

## Evidence / decisions
- Baseline is main at 63ca265; prior full+focused verification covered 775 cases. Re-run focused engine baseline before edits.
- Execute inline; independent final review only. No new gameplay settings required.

- Pure/model/UI/persistence/coaching checks passed: 56 tests across 12 focused files, with 19 targeted tests after the physical assignment refinement.
- Independent review found a coverage inconsistency in the pre-help screen probe. A call-through regression reproduced it, then passed with the actual resolved screen coverage used throughout the action (3 tests across 2 files).
- Final seeded audit passed 1,000 games with exact score accounting; controlled equal-skill cases demonstrate mass/post versus movement/drive tradeoffs and bounded type resistance. Results: `docs/matchup-balance-audit.json`.
- All 60 historical games across six prior model combinations remained byte-identical after the final fix.
- Production TypeScript/Vite build passed. Existing bundle-size advisory remains.
- Browser QA used a separate localhost:5176 origin: previewed Snorlax/Pikachu post leverage, drafted a four-team league, completed its 14-game season and semifinal, inspected the new report, and reloaded to the identical report and 135–109 score. Expanded all 57 matchups and collapsed to eight. At 390 px, page width stayed 390 px and the table scrolled within its 334 px container. No browser warnings/errors. Viewport reset afterward. Screenshot retained in primary checkout `output/body-matchups/matchup-report.png` (not committed).
- Final accounting review reproduced a false type-counter count when a substitution improved only the physical matchup. Fixed the counter to compare pure type coverage; its regression plus related simulation tests passed (20 tests, 5 files).
- Performance profiling identified repeated type-key construction and repeated matchup edges while comparing plays. Per-game weak pair caches and one edge snapshot per play comparison reduced a 1,000-game benchmark from 12,172 ms to 6,853 ms. Twenty complete new-rule results stayed byte-identical; all 60 historical results also remained byte-identical. The full 1,000-game audit was rerun successfully.
- The first full run hit existing replay watchdogs (97 s for three save validations and 389 s for a malformed-save/rookie lifecycle batch). It was stopped for profiling. After optimization, a three-worker full run is used on this ten-core host; default project worker count remains one. Integration watchdogs are adjusted where measured whole-season workloads exceed their old budgets, without changing any assertions.

- Final regression coverage: **791 distinct tests across 119 files** have passing results. The optimized full run passed 749; the remaining cases were replay watchdogs, follow-on App failures after timed-out async work, and one new assertion incorrectly assuming a legacy summary-only archive contained replay data. Watchdogs and full-season UI waits now reflect measured workloads; every assertion remains. The legacy test now explicitly verifies absent replay data plus unchanged original team rules. Reruns: save/archive 26 passing, selected migration/postseason recovery 3 passing, compatibility 44 passing, and the complete App/free-agency/franchise/season batch (65 passing). A title-by-title reconciliation confirms all 791 cases have passing results, with no unresolved failures. No production logic changed after the optimization.
- Final optimized build passed (existing chunk-size advisory only). Browser replay after optimization retained the identical physical report and playoff score, with no warning/error entries. QA tab closed and viewport reset; QA server stopped.

- Delivery adjustment: another chat moved the primary checkout onto `codex/grand-table-foundation` and is actively committing unrelated `mega-catan/` work. Keep that branch and its working files untouched. This task owns `main` in the attached `/Users/sam/.codex/worktrees/pokemon-matchup-engine/PokeBBall` checkout and serves the basketball preview from there at the existing 127.0.0.1:5173 origin. Retain the worktree while it is the active game checkout; archive it only after moving that preview elsewhere.
