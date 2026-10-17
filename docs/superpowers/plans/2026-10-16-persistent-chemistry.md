# Persistent chemistry implementation plan

**Goal:** Earn pair familiarity from real shared court time and carry it through seasons and roster changes.
**Architecture:** Pure pair-memory helpers plus immutable fixture context; shared lineup model consumes pair history; versioned season/playoff replay produces identical state.
**Tech stack:** TypeScript, React, Vitest/Vite.
**Spec:** docs/superpowers/specs/2026-10-16-persistent-chemistry.md

- [x] Core pair keys, validation, growth/decay, roster transfers, snapshot helpers and deterministic tests.
- [x] Actual simulated and playable shared-minute telemetry, capped model/coaching effects, no bench/preview attribution.
- [x] Independent version lifecycle, sequential regular/playoff growth, official validation, frozen archive/save compatibility and next-season inheritance.
- [x] Coaching and market continuity, roster transaction integration, current/historical UI reporting.
- [x] Focused regression, full franchise transition/replay and responsive rendering; independent review and repairs.
- [x] Document and prepare validated work for delivery to main; verify the remote SHA after pushing the final commit.

Review focus: no double credit from replay/restore; pregame snapshot used for historical boxes; earned playoff minutes retained; newly drafted/released players cannot inherit a slot's history; pair trades/reunions preserve existing memory; no-flag hashes remain exact; bounded finite saves and duplicate/stale official games rejected.

## Execution and verification

- Core model was driven by failing tests before implementation. Final core/growth-match/chronology/court group: **13 tests passed**. It checks actual active pairs, clock/player-minute conservation, fixed fixture context, diminishing returns, old coarse-bonus replacement, package history, reunions, empty adoption and downgrade rejection.
- Simulation/compatibility/free-agency group: **29 tests in 9 files passed**. Static chemistry, physical abilities, evaluation and earlier engine replay hashes remain unchanged. Old-rule fixtures explicitly omit the new independent version.
- Coaching/reporting group: **46 focused tests passed**, including actual lineup selection, returning-versus-new recruiting, current progress projection, weighted season reporting and historical box-score snapshot dependencies.
- Independent review found missing snapshot context in two UI resolvers, unreconciled solo save banks, and blocking local historical verification. Resolvers now pass the fixture context. `chemistryChronology.ts` reconciles verified archives and ordered transactions; growth-enabled solo archives retain replay inputs. Local career restoration now runs in a worker with progress, cancellation, retry and confirmed reset. The reviewer reinspected all three repairs and found no outstanding Critical, Important or Minor issues.
- Browser check used an isolated real 4-team, 14-game season. 1440px desktop and 390px mobile had zero page errors and no document overflow. Screenshots in `docs/design/persistent-chemistry-{desktop,mobile}.png` were visually inspected; temporary preview files were removed and user saves untouched.
- Shared-host CPU contention caused existing computational tests to exceed narrow explicit watchdogs (10-generation career and full arcade game). Their watchdogs were increased without changing assertions; final reruns are recorded below.
- Full 30-team franchise integration plus prefix/official lifecycle group: **19 tests in 4 files passed, 317.52 seconds**. Includes complete season/playoffs, final bank inheritance, archived box replay, development/trades, save restore, next-year retention and tampered bank rejection.
- All four arcade ability/chemistry files, including the full physics game, passed: **51 tests, 19.56 seconds**. Growth follows live time through substitutions and overtime; paused/dead-clock periods earn no minutes. The previous static-chemistry arcade hash remains exact.
- Final core/chronology/official/historical replay group: **28 tests in 7 files passed, 33.04 seconds**, after tightening zero-minute official exposure validation and fixing exact half-cent offseason retention rounding. The focused local two-year adoption/restore plus chronology group also passed **4 tests, 15.78 seconds** with the final arithmetic.
- Async restoration checks: **8 focused tests passed**, covering preserved original bytes, corruption, worker unavailability, progress, cancellation, stale messages, retry and explicit reset. Native Chrome verified cancellation and a successful real-worker retry with `[[0,1],[1,1]]` archive progress, year 2 restored, 200 responsive main-thread timer ticks, and no page errors. No localStorage was used by the smoke harness.
- Final production build, TypeScript and diff check passed. The worker is bundled locally; no new dependencies. Vite retains the existing large-main-bundle advisory.
- The isolated ten-generation local-career regression passed with final retention arithmetic (**50.49 seconds**), including all assertions previously interrupted by its 20-second watchdog.
- Interactive season/playoffs: all **8 cases** have passing evidence. The initial run passed 7; its complete 16-played-game playoff case exceeded the default 60-second watchdog at 69.34 seconds. That unchanged case passed in **64.66 seconds** with an explicit 180-second limit. Official final totals, awards, CPU bracket projection, home/away contexts and completed mixed-season replay are covered.
- Older model-1/2 save tests now explicitly construct historical inputs without the new growth flag; their boundary assertions include adoption of empty pair memory. Modern growth-enabled archives remain covered by the complete integration test. Final compatibility selection: **8 tests across 5 files passed, 383.56 seconds; 67 unrelated cases intentionally skipped**. Covers legacy archive/model contracts, second-year roster adoption and both ordinary/developed pregame save roundtrips. An earlier broad five-file run was stopped without a result because it repeated extensive full-season verification; it is not counted as a pass. The entire repository test suite was not rerun.
