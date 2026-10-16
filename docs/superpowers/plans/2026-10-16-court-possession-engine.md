# Court possession engine implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement inline, with test-first verification and a final independent review.

**Goal:** Make court geometry, chained actions and screen coverages change all simulated games.
**Architecture:** A versioned court resolver feeds the shared match scoring/rebound pipeline. A separate clock branch preserves legacy replays. New telemetry drives a game-insights component.
**Tech Stack:** TypeScript, React, Vite, Vitest; no new dependencies.
**Spec:** docs/superpowers/specs/2026-10-16-court-possession-engine.md

## Global constraints

- Eight-player rosters; same shared simulator for every simulated fixture.
- Old saved rules and RNG remain frozen; new solo franchise seasons opt in.
- `courtVersion: 1`; actual game-time accounting; bounded action loops.
- Arcade controls remain their separate physics engine.

## Review focus

- Foul-out replacements during a possession must not receive time they did not play.
- Short period clocks and repeated offensive rebounds must not exceed period duration.
- Shot actors, coordinates and coverage must reflect the final action, including kickouts.
- Archive reconstruction and compact telemetry must be deterministic.
- Legacy save migration must not silently opt historical seasons in.

### Task 1: Court resolver and shared simulation

Files: create `src/game/courtPossession.ts`, `src/game/courtTypes.ts`, tests; modify `match.ts`, `engineInsightsTypes.ts`.
Interfaces: `resolveCourtPossession` consumes five offensive/defensive Player objects, assignments, play, tactic, defense, shot/period clocks and RNG; returns actors, final geometry, action chain and terminal outcome.
- [x] Write integration tests for sequence evidence, real clock accounting and compact/full equivalence; watch missing evidence fail.
- [x] Write controlled geometry/coverage/clock tests; implement resolver and bounded movement/actions.
- [x] Integrate terminal shots, turnovers, help and clock accounting without changing legacy path.
- [x] Verify targeted tests and byte-identical legacy fixtures; commit.

### Task 2: Rules lifecycle

Files: `types.ts`, `draft.ts`, `league.ts`, `franchise.ts`, `archive.ts`, `persistence.ts`, `franchiseValidation.ts`, `localLeague.ts`, `localCareer.ts`; persistence tests.
Interfaces: optional `courtVersion?: 1` carried through all current and archived league inputs.
- [x] Write new-run/CPU/local/save/version rejection and season-boundary tests; watch fail.
- [x] Implement propagation and validation, preserving historical inputs.
- [x] Verify lifecycle/replay tests; commit.

### Task 3: Explain possessions

Files: new `CourtInsights.tsx` and tests, `GameInsightsPanel.tsx`, `insights.css`, rules/README.
Interfaces: MatchInsights.court contains recorded CourtSequence objects; no RNG in UI or aggregation.
- [x] Test coverage summary, sequence selection, court diagram and absent legacy data.
- [x] Implement responsive accessible insights and contextual shot-chart labels.
- [x] Run UI tests, build and browser checks; commit.

### Task 4: Audit and deliver

Files: audit script/results, handoff and this plan.
- [x] Run entire test suite and repair genuine failures with reproductions.
- [x] Audit varied rosters/tactics, timing, accounting and performance.
- [x] Request independent whole-change review, address important findings and verify.
- [x] Commit delivery notes and push main; keep the active preview serving the basketball checkout.

## Execution evidence

Initial checkout b692cd9; using attached basketball worktree, leaving the unrelated primary checkout alone. User authorization permits continuous implementation and final GitHub push without an additional approval menu.


- Shared engine, lifecycle and UI commits: `abf7861`, `52bdbea`, `e1ef0fe`.
- Final focused checks: 24 tests passed across five files. The independent review's putback/screen-credit and clipped-clock findings were reproduced with failing assertions, then repaired. Browser inspection additionally exposed repeated end-of-period releases; a red/green regression now requires a rushed advance to use the remaining period, with a distance penalty for the heave.
- True fractional player minutes replace the legacy eighth-minute grid only for court games. Career validation keeps integer counting stats and league-wide minute conservation with floating-point tolerance. Rich archives still replay and compare frozen player totals.
- 48 baseline fixtures across six prior engine combinations reproduce byte-for-byte. Compact and full telemetry produce identical match results.
- `node scripts/court-audit.mjs --samples=100`: 1,000 games across 30 rosters, five tactics and the previous/current engine. All score/minute/clock assertions passed. Current-model home averages range from 108.76 to 122.69 points and 95.15 to 106.66 possessions; all five coverages occur. These are fictional tuning checks, not measured basketball calibration. Results: `docs/court-balance-audit.json`.
- Initial browser QA on isolated `localhost:5177` checked actual simulated insights, attack/team/coverage navigation, empty coverage filters, court positions and player labels. No page overflow at 390px or 320px; warning/error log was empty. Evidence: `docs/design/court-possession-desktop.png` and `court-possession-mobile.png`.
- TypeScript and production build passed. Vite retains the existing large-main-chunk advisory. Full integration verification and final GitHub synchronization are recorded below once complete.

- All nine archive tests passed (327s), including full-season reconstruction, mixed played/simulated games and corrupted-save rejection. The four-season persistence replay required a 120-second watchdog (passed in 63s); the local-league season plus two restores required 90 seconds (passed in 50s). Assertions and simulation scope are unchanged.
- Coordinated with the user's “Plan web and multiplayer release” chat under their standing authorization. Integrated its validated 21-file basketball-only patch, SHA-256 `20914610954ace90f71b453cca79c5572a8c7fc157f41bce5ba7fefbd53c7295`, preserving the court flags. No Grand Table files or shared-primary index changes were included. Combined checks covered 61 tests; the sole timeout was repaired and that exact case passed. An additional 1,350 old/new rating/rotation cases were byte-identical, as were all 1,000 audit outcomes and 48 legacy matches. The combined production build passed.

- Final production build and the 1,000-game audit passed after the last finishing-action correction. A kickout uses the receiver’s spot-up context, a subsequent drive uses isolation, and a paint-to-paint pass is no longer labeled a kickout. The existing body-matchup regression exposed this issue and now passes on current rules. The 48 legacy fixtures remain byte-identical.
- Refreshed desktop/mobile screenshots use the final shared court resolver (seed 7), its actual report and a hedge/pass/drive sequence. No overflow at 390 or 320 pixels and no browser warnings/errors. Temporary QA files and tabs were removed. The active preview at `127.0.0.1:5173` serves this basketball worktree; the user’s Year 2 franchise remained intact.

## Final verification

The full run covered 125 files / 822 cases: initially 780 passed, 20 failed, and 22 were skipped after a setup watchdog expired. Every failed or skipped case then passed in focused follow-ups; the entire suite was not rerun a second time. Repairs kept all assertions: frozen-rule fixture flags, fractional-minute tolerance, the final-action engine correction, and watchdogs sized for complete season/archive reconstruction. A diagnostic copy of the package-trade test retained every assertion and timed all three restores (31–32 seconds each, 94 seconds total); that temporary file was removed. The two-season development/trade/restore case passed in 96 seconds. The archived-box UI case passed in 15.3 seconds after its outer watchdog was corrected.

Additional final evidence: 26 engine/lifecycle/frozen-rule cases passed together; all 22 franchise-persistence cases passed; the full archive suite passed all nine cases; the four-season persistence and local season/playoff restore cases passed. Final TypeScript/production build, 48 legacy fixtures, 1,000-game audit, desktop/mobile inspection, and whitespace checks passed. The existing large-bundle build advisory remains. Standalone Playwright CLI was not run; browser QA used the supported in-app browser.

The coordinated draft patch is commit `993dc85`; finishing-action and replay verification repairs are `f23cbda`. The basketball preview stays on port 5173 from this worktree, and the separate primary checkout remains untouched. The eight delivery commits through `0425e0d` were fast-forwarded to `main` and pushed; `git ls-remote` confirmed the same SHA on GitHub. This final documentation commit records that verification.
