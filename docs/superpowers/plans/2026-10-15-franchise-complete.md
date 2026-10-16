# Connected Franchise Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans, with independent domains delegated under dispatching-parallel-agents. Track checklist items below.

**Goal:** Deliver the five requested connected franchise features locally and on GitHub.
**Architecture:** Optional versioned progress and coaching inputs preserve old deterministic paths; frozen archives support career rows and on-demand historical boxes. Parent integrates state/App and UI entry points; isolated agents own game progression, coaching, and archive/persistence domains.
**Tech Stack:** React, TypeScript, Vite, Vitest, local browser persistence; no new runtime dependency.
**Spec:** docs/superpowers/specs/2026-10-15-franchise-complete-design.md

## Global Constraints
- Thirty eight-player clubs and 240 unique Gen I–II species.
- No changes to prior no-extension simulation outputs; preserve corrupt save source bytes.
- Regular progress max82 rounds; playoff max105 games. Four 60s arcade quarters, 25s official overtime, x12 statistics.
- Custom target minutes sum240; each0–48; five distinct positive-minute closers.
- Training respects annual -10/+12 and cumulative ±30 bounds.
- Old discarded archive detail is unavailable, not fabricated.

## Review Focus
- Double final callbacks, stale matches and reloads must never double count.
- Away fixtures map user-controlled side0 to the correct league team.
- DNPs cannot break career/save validation or inflate appearances.
- Historical replay must use archived training/rotation/rosters and official results.
- Existing saves must restore unchanged without silently dropping optional extensions.

## Interfaces
Shared definitions in `src/game/franchiseFeatures.ts`: RotationPlan, PlayerTrainingPlan, TrainingPlans, OfficialGame, SeasonProgress, SeasonReplayArchive. Run adds rotationPlan and seasonProgress; LeagueTeam adds rotationPlan; Franchise adds trainingPlans and model3; FranchiseSeason adds replay. Playoffs model2 adds playedGames.

## Tasks
- [x] 1. Official engine: red/green tests for x12 conversion, overtime/minutes/shot splits/DNPs, mixed-prefix replay and playoff overrides. Own interactiveSeason.ts, officialGame.ts, season.ts, playoffs.ts, playoffTypes.ts, arcade engine files; publish documented APIs for parent/persistence.
- [x] 2. Coaching: red/green tests for plan validation, rotation effects/closers/cache isolation and training focus/intensity; implement rotationPlan.ts, training.ts, ratings.ts, match.ts, development.ts, RotationEditor.tsx, TrainingPanel.tsx. No central state/App edits.
- [x] 3. Archive/persistence: red/green tests for new/old round trips, corruption, DNP totals and historical replay. Implement archive.ts, franchise.ts, franchiseValidation.ts, persistence.ts, CareerDetail.tsx, HistoricalGames.tsx; preserve frozen summaries. Parent owns FranchisePanel wiring.
- [x] 4. Parent integration: reducer actions for rotation/training/progress and official outcomes; cancellable async hook operations; next-game panel; official arcade launch/results; franchise career/history navigation. Meaningful integration tests before implementation.
- [x] 5. Run full suite/build; independent review and fixes; browser official game/coaching/archive/career/mobile/reload QA; docs, tested commits/push, verify remote while preserving concurrent work.

## Verification record

- Feature commit `7d6209b` pushed to `origin/main`; remote SHA verified.
- Exact staged feature tree: 397/397 tests in 64 files; TypeScript and production build pass.
- Independent review complete; official regular/playoff submission, duplicate callbacks, reloads, DNPs, rotations, training, historical replay and old-save enrichment covered.
- Browser QA: full official game with substitution, archived season, next-year continuity, career detail, historical Finals box, saved training/rotation and responsive layouts at 1440/390/320px.
- Concurrent local-league changes remain owned by their other task and were preserved.
