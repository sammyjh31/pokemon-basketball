# Local Snake League Implementation Plan

> **For agentic workers:** Implement inline with superpowers:executing-plans and test-driven development.

**Goal:** Friends draft separate teams locally against CPU teams and compare an existing 82-game simulation.
**Architecture:** A separate draft model and save key produce a fixed-roster Run for the existing simulator. A local league screen reuses player cards, scouting and league results, entered through a narrow App navigation addition.
**Tech Stack:** Existing React, TypeScript, Vite, Vitest and Playwright. No new dependencies.
**Spec:** docs/superpowers/specs/2026-10-15-local-snake-league.md

## Global Constraints

- 30 teams, eight unique players per team, 2–30 human managers.
- Reverse one seeded random order on alternate rounds; never consume a human turn automatically.
- Keep the current franchise/challenge save unchanged.
- Reuse existing simulation and team identities.
- Preserve unrelated checkout edits; do not commit them.

## Review Focus

- Round-boundary back-to-back picks and CPU skipping must stop correctly.
- With legendaries disabled, exactly 240 eligible players must fill all rosters.
- Malformed or unwritable browser storage must not silently destroy progress.
- Completed results must restore deterministically; duplicate simulation clicks must not reroll.
- Mobile controls, keyboard access, reset confirmation and navigation must preserve progress.

## Task 1: Draft model and compact saves

Files: src/game/localLeague.ts, src/game/localLeague.test.ts.
Interfaces: createLocalLeague, currentLocalTurn, pickLocalPlayer, advanceLocalCpu, localLeagueTeams, localLeagueRun, swapLocalSlots, updateLocalCoaching, parseLocalLeague, rankLocalManagers.

- [x] Write and run failing tests for reversing rounds, CPU boundaries, full unique rosters, setup/pick rejection, save validation and exact fixed-roster simulation.
- [x] Implement the pure local league model and validation.
- [x] Run focused model tests.

## Task 2: Pass-and-play screen and navigation

Files: src/components/LocalLeagueMode.tsx, src/components/LocalLeagueSetup.tsx, src/components/LocalLeagueDraft.tsx, src/hooks/useLocalLeague.ts, src/localLeague.css, src/App.tsx, src/components/Scoreboard.tsx, src/components/LocalLeagueMode.test.tsx.

- [x] Write and run failing integration tests for setup, human picking, save/restore, invalid saves, replacement confirmation and preserving the original game.
- [x] Implement setup, draft/scouting, roster/coaching review, async simulation and the friends leaderboard plus LeaguePanel.
- [x] Add an accessible Local league entry and back navigation.
- [x] Run component and model tests.

## Task 3: Verify and document

- [x] Run the full unit suite and production build; report unrelated pre-existing failures precisely.
- [x] Exercise a complete two-friend draft, simulation and refresh in a browser, including mobile layout.
- [x] Review new code for the five failure classes above and repair meaningful findings.
- [x] Document how to play in README.md and open the local game.

## Verification ledger

- Draft model: 5 tests passed, including all 240 unique nonlegendary players and deterministic 1,230-game replay.
- Component integration: 4 tests passed, including independent saves, invalid/unwritable storage, season restoration, and original-game navigation.
- Independent review found one keyboard focus issue. A regression test reproduced focus falling to BODY after a pick; focusing the new turn heading changed that test from failing to passing. No other actionable findings.
- Full unit suite passed: 406 tests across 66 files. Build and TypeScript validation passed.
- All 12 desktop/mobile browser checks passed, including a complete two-friend draft, roster/coaching review, season simulation, refresh restoration and preservation of the solo save.
- Work remains in the current checkout because the local dev server and ongoing franchise work use it; unrelated staged changes are preserved and excluded from this task.

## Playoff extension requested October 15

- [x] Add backward-compatible optional `playoffGames` saves and validate the count only for completed seasons.
- [x] Connect local league progression and restoration to the existing playoff engine, preserving regular-season results and cancelling interrupted actions.
- [x] Extend the shared playoff panel with friend status cards, bracket highlights and championship ownership while keeping the solo defaults.
- [x] Verify partial and championship restoration, old completed saves, interrupted actions, reset, and corrupt-save preservation with real simulation tests.
- [x] Review the extension independently and repair findings. The sole finding was an initial write before playoff replay validation; a failing regression reproduced it, and gating completed-save writes until replay succeeds resolved it.
- [x] Complete final unit, build and desktop/mobile verification.

Playoff verification: initial model/presentation/integration checks passed (21 tests). Expanded local integration checks passed (6 tests). Final full unit suite passed: 410 tests across 66 files. Production build and TypeScript validation passed. All 12 browser checks passed, and both local desktop/mobile championship flows passed again after the save-preservation fix. Reviewed desktop/mobile championship screenshots; no page overflow.
