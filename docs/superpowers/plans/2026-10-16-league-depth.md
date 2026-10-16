# League Depth Implementation Plan

> **For agentic workers:** Use the parallel-agents skill for the independent domains below and TDD within each domain. Parent integrates and verifies the combined work.

**Goal:** Deliver configurable multi-season friend leagues with deeper, explainable basketball simulation.
**Architecture:** Optional versioned engine and league rules preserve old simulations. Pure career transitions own persistence; match telemetry feeds reusable game/season insight components. New modules avoid rewriting solo franchise paths.
**Tech Stack:** React, TypeScript, Vite, Vitest, Playwright; existing bundled data/assets.
**Spec:** docs/superpowers/specs/2026-10-16-league-depth.md

## Global Constraints

- No evolutions, injuries/recovery/aging/retirement, or draft-pick trades.
- Eight unique species per club; no duplicated league members.
- Generational mode starts with GenI; full-pool mode uses all1025 species and never runs later rookie drafts.
- Abilities on by default with bounded effects. Old saves without engineRules retain exact outcomes.
- Do not edit the primary checkout until reviewed integration. Do not overwrite user browser saves.

## Review Focus

- Small initial pool cannot fill30 clubs; setup and parser reject oversubscription.
- Short playoffs and small brackets must still produce a valid champion/MVP.
- Refresh/double clicks cannot reapply offseason development or draft transactions.
- Telemetry totals reconcile to boxes and team scores; display coordinates do not alter RNG.
- Empty/DNP/tiny samples and historical games with no telemetry remain honest and usable.

## Shared contracts

Engine owner defines src/game/engineInsightsTypes.ts with EngineRules {version:1; abilities:boolean; adaptiveCoaching:boolean; familiarity:number}; LeagueTeam.engineRules optional and LeagueMatch.insights optional. Default absent means legacy. Types module also defines ShotEvent, LineupSummary, DefenseSummary, CoachingAdjustment and MatchInsights; analytics owner agrees final event fields with engine owner before implementation.
Career owner defines additive local draft options and pure career APIs; parent consumes these in setup/hook/UI. It owns localLeague.ts, new localCareer/localSeason/localFormat modules, playoffs.ts/playoffTypes.ts and their tests; parent owns hook and all local UI.
Engine owner owns match.ts, engineInsightsTypes.ts, engineDepth.ts, types.ts additions, balance audit and engine tests. Analytics owner owns new GameInsightsPanel/SeasonInsightsPanel, insight analysis helpers, CSS/tests. Parent alone wires existing LeaguePanel/LeagueBoxScore to those components.

## Tasks

- [x] Engine: red tests for bounded physical/tendency/chemistry/ability effects and legacy replay; implement opt-in behavior, adaptive coaching and reconciled telemetry; green targeted tests; run/document balance audit.
- [x] League/career core: red tests for rules/pool limits, schedules, short playoffs, two-mode transitions, rookie choices/trades and invalid/duplicate saves; implement pure state transitions/replay; green targeted tests.
- [x] Insights: red fixture tests for postgame drivers, shot charts, lineup/defense denominators and player trends; implement accessible responsive components using engine telemetry and on-demand replay; green tests.
- [x] Parent draft advice: test roster need/scarcity/explanation; implement recommendation panel and player physical/ability scouting.
- [x] Parent local UI: setup format/progression/ability controls; career offseason flow, trades, rookie picks, history; refresh-safe hook and save boundaries. Test full two-year flow and both modes.
- [ ] Integration: preserve exclusions and all legacy behavior; independent review; full suite/build, seeded balance audit and desktop/mobile browser workflows. Record evidence, merge reviewed changes, commit/push authorized project work.

## Verification so far

- Full pre-integration suite: 545 tests across 89 files pass.
- Desktop and mobile: both career modes across two seasons, frozen history, rookie save reload, trades, insights; 30-club full-pool season/playoff/reload flow. All six browser tests pass.
- Seeded 3,600-game audit passes; signature-on paired mean margin +0.675 points.
- Independent review found recommendation recalculation latency and rookie keyboard-focus loss; both fixed.
- Free agency integrated from 363723b. Final combined verification and preservation of uncommitted type work pending.
