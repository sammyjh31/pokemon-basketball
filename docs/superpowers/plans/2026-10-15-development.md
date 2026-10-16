# Franchise Development Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans with independent work delegated under dispatching-parallel-agents. Track task completion below.

**Goal:** Add volatile performance-based offseason development and CPU-to-CPU trades to persistent franchises.
**Architecture:** Per-species skill offsets travel with rosters; completed league inputs freeze them. A deterministic once-per-year offseason processor emits development reports and chronological CPU trades. Franchise model 2 and season model 5 preserve older paths.
**Tech Stack:** React, TypeScript, Vite, Vitest, browser LocalStorage; no added dependencies.
**Spec:** docs/superpowers/specs/2026-10-15-development-design.md

## Global Constraints
- Eight players per club; 30 clubs; 240 distinct species; user club ID 0 excluded from CPU trades.
- Large swings: annual skill deltas -10..12, cumulative offsets -30..30, attributes 0..100.
- No change to no-development model 3/4 deterministic results or factual Pokémon data.
- Existing local main checkout and commit/push authorization remain in force.

## Interfaces
`DevelopmentSkill` excludes shooting/playmaking/rebounding summaries from Attributes; `DevelopmentRatings = Partial<Record<DevelopmentSkill, number>>`; `PlayerDevelopment = Partial<Record<number, DevelopmentRatings>>`. Optional `LeagueTeam.development` stores exactly its roster members. Ratings/profile APIs gain optional offsets; team/rotation APIs gain optional per-species maps. `SeasonResult.modelVersion` permits 5.
`PlayerDevelopmentChange { pokemonId, teamId, before, after, minutesPerGame, impactPer36, changes, outcome, reasons }`. `OffseasonReport { modelVersion:1, year, players, tradeStart, tradeCount }`. Optional `Franchise.offseasons` is required in model 2; modelVersion 1|2. `FranchiseTrade` optionally has fromTeamId/source:'cpu'/reason; omitted source/from means a legacy user trade (from 0).
`processOffseason(state:GameState):GameState` is idempotent; parent owns processor, franchise helpers and reducer. `PROCESS_OFFSEASON` action allows old offseason saves to catch up. UI callback `onProcessOffseason` dispatches it. Validation reconstructs offsets from reports and requires team-owned offsets to agree. Reports are consecutive from migration year, not retroactive.

## Review Focus
- Existing offseason saves with earlier user trades: no replay or loss of their actions.
- Changed skill maps must invalidate profile/minute caches and affect playoffs and game replay.
- Traded players retain offsets and prior club honors without duplicate species or career totals.
- Failed/corrupt saves cannot silently discard development or overwrite their original bytes.
- Back-to-back offseason actions cannot reroll changes or move the same CPU player twice.

## Tasks
- [x] 1. Engine: failing tests for developed attributes/profiles, cache isolation, model-5 replay and unchanged legacy input; implement optional rating inputs through match/season paths.
- [x] 2. Offseason: failing tests for deterministic growth/decline, performance/minute influence, bounds, trade fairness/conservation, idempotence and fresh-year snapshots; implement development, CPU trades and reducer integration.
- [x] 3. Persistence: failing tests for old-save compatibility, model-2/5 round trips, reports/offsets/transactions corruption, active-game replay; implement bounded validation and safe recovery.
- [x] 4. UI: failing tests for report filters/details, CPU trade attribution, processing/advance controls and developed ratings; implement report components and current-roster displays.
- [x] 5. Integrate focused tests, full suite and build; independent review; browser two-season/reload/mobile checks; docs/handoff; commit and push.

Validation: 327 tests across 51 files pass; production build/typecheck and diff checks pass. Browser QA migrated an older Year 2 offseason, completed a developed Year 3 season/playoffs, archived the next report, then reloaded with both years retained. Responsive widths 1440/390/320 passed. Independent review fixes (impact units and ArcadeMode forwarding) have failing-before/passing-after regressions. Existing main and arcade work are retained; delivery uses the standing commit/push authorization.
