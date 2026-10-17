# On-court Chemistry Implementation Plan

> Agentic workers: use the executing-plans workflow within each independent domain; test meaningful behavior before implementing it.

**Goal:** Pokémon on the court affect each other through chemistry and named ability combinations, with automatic coaches choosing those units.
**Architecture:** One pure lineup model supplies shared simulation, arcade and coaching effects. Independent version gates preserve prior games and adopt at season boundaries. Existing reports display lineup evidence.
**Tech stack:** TypeScript, React, Vite, Vitest.
**Spec:** docs/superpowers/specs/2026-10-16-lineup-chemistry.md

## Constraints

- Eight-player rosters; only distinct active players contribute.
- `chemistryVersion: 1`; no flag means exact ec43701 behavior.
- Ability switch disables ability links, not ordinary basketball chemistry.
- No extra random draws, unbounded provider stacking, new dependencies or user-save edits.
- Preserve manual minutes/closers, foul-out handling, fatigue, and individual ability-stat attribution.

## Review focus

Bench or fouled-out donors must stop contributing immediately. Midgame plans must refresh cached chemistry. Ability-off leagues must retain chemistry without magical links. Full-season searches must stay bounded. Existing local/solo/official archives must retain the exact historical rule versions.

## Tasks

- [x] Capture current replay; create core model/API and tests for bounds, distinct participants, permutation, disabled effects and substitution changes.
- [x] Integrate actual simulation passing/movement/screens/rebounds/defense/drain with cached current-five effects and per-lineup insights; suppress duplicate legacy chemistry only on new rules.
- [x] Independently integrate version lifecycle/archive/official validation; arcade mechanics and substitutions; coaching unit search/game-plan/shared value and UI. Tests cover each domain's failure modes above.
- [x] Run focused regression suites, complete franchise replay/save/restore, season performance checks, production build and desktop/mobile rendering. Independent whole-change review and repairs.
- [x] Document final mechanics/limits, commit and push to main, verify remote SHA.

## Execution and verification

- Shared model and simulation were driven by failing checks for active-five links, disabled abilities and actual recorded chemistry, then passed after integration. Core tests also cover permutation, unique participants, strongest contribution, Plus/Minus and bounded effects. Court tests exercise changed geometry and prohibit false individual physical-ability attribution.
- Final focused sweep: **151 tests across 28 files passed** (33.66 s), covering chemistry, coaching, shared evaluation, official games, current/prior frozen replays, court mechanics, season aggregation, arcade and UI. Additional domain checks passed: 17 market checks; local league copy regression; ability lifecycle and historical local rival fixtures. This was a targeted regression sweep, not the full multi-season suite.
- Frozen ec43701 simulation hash: `dd8e56f5465aed4601f729c03232c84d00d1ec466437c20ab24680294fe71049`. Physical-enabled arcade hash: `b0b38e2207a91a896df6564d7f8c548d58ab3742730586742422cd58292ece30`. Earlier physical/evaluation and arcade baselines remain unchanged.
- Independent read-only review found no critical or important issues; reviewer ran 25 focused tests. One optional optimization remains: arcade per-player reads revalidate both lineup caches. Its measured absolute idle-frame overhead was about 0.4 ms, so frame-boundary-only refresh was deferred pending profiling rather than changing direct-caller semantics.
- Isolated Chromium rendering at 1440px and 390px showed five projected players, three recorded lineup samples, no browser exceptions and no page overflow. Mobile scroll/detail inspection prompted removal of the sticky lineup column on narrow screens; partnership text is now fully readable. Screenshots: `docs/design/lineup-chemistry-{desktop,mobile,mobile-detail}.png`. Preview harness removed; user saves untouched.
- Limits: bounded heuristics choose projections rather than an exhaustive roster optimizer; cohesion is not a win probability; relationships do not accumulate new persistent solo-season history. Existing local familiarity remains in use. Partnership opportunities do not create shot activations, guaranteed rebounds, or causal points-attributed stats.

- Full 30-team franchise integration: **1 test passed in 143.30 s**. It simulates regular season/playoffs and offseason, reconciles career physical counters, validates actual-five partners, reproduces an archived detailed match exactly, restores the complete save, advances to Year 2 with 240 unique roster species, and rejects mixed live/archive chemistry versions. The first test draft incorrectly expected an immediate notice from the completed-season async loader; the negative control now uses a fixed-roster Year 2 save, whose validation is immediate. No production change was needed for that test correction.
- Final `npm run build` and `git diff --check` passed. Vite retains the existing main-chunk size advisory. Origin/main was still ec43701 immediately before delivery.
