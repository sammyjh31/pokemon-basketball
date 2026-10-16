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
- [ ] Write integration tests for sequence evidence, real clock accounting and compact/full equivalence; watch missing evidence fail.
- [ ] Write controlled geometry/coverage/clock tests; implement resolver and bounded movement/actions.
- [ ] Integrate terminal shots, turnovers, help and clock accounting without changing legacy path.
- [ ] Verify targeted tests and byte-identical legacy fixtures; commit.

### Task 2: Rules lifecycle

Files: `types.ts`, `draft.ts`, `league.ts`, `franchise.ts`, `archive.ts`, `persistence.ts`, `franchiseValidation.ts`, `localLeague.ts`, `localCareer.ts`; persistence tests.
Interfaces: optional `courtVersion?: 1` carried through all current and archived league inputs.
- [ ] Write new-run/CPU/local/save/version rejection and season-boundary tests; watch fail.
- [ ] Implement propagation and validation, preserving historical inputs.
- [ ] Verify lifecycle/replay tests; commit.

### Task 3: Explain possessions

Files: new `CourtInsights.tsx` and tests, `GameInsightsPanel.tsx`, `insights.css`, rules/README.
Interfaces: MatchInsights.court contains recorded CourtSequence objects; no RNG in UI or aggregation.
- [ ] Test coverage summary, sequence selection, court diagram and absent legacy data.
- [ ] Implement responsive accessible insights and contextual shot-chart labels.
- [ ] Run UI tests, build and browser checks; commit.

### Task 4: Audit and deliver

Files: audit script/results, handoff and this plan.
- [ ] Run entire test suite and repair genuine failures with reproductions.
- [ ] Audit varied rosters/tactics, timing, accounting and performance.
- [ ] Request independent whole-change review, address important findings and verify.
- [ ] Commit delivery notes and push main; keep the active preview serving the basketball checkout.

## Execution evidence

Initial checkout b692cd9; using attached basketball worktree, leaving the unrelated primary checkout alone. User authorization permits continuous implementation and final GitHub push without an additional approval menu.
