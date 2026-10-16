# Possession Depth Implementation Plan

> Use superpowers:executing-plans for inline implementation, with a fresh final reviewer.

**Goal:** Make rebounds, transition and assisted creation meaningful and measurable.
**Architecture:** Pure bounded possession helpers, a version-gated match integration, reconstructed compact game/season reports. Preserve legacy random calls when the flag is absent.
**Tech Stack:** TypeScript, React, Vitest, Vite.
**Spec:** docs/superpowers/specs/2026-10-16-possession-depth.md

## Global constraints
Eight-player rosters; no lifecycle/evolution/pick trading; old saves retain their original engine; deterministic telemetry.

## Review focus
- Technical free throws and second-chance free throws reconcile to team totals.
- Bench substitutions do not award an outlet assist to an off-floor player.
- Period boundaries remove unconsumed transition advantages.
- Mixed/malformed version flags fail loading and historical archives retain missing flags.
- Missing played-game telemetry is excluded, never silently counted as zero.

### Task 1: Pure mechanics and match integration
- [x] Tests for crash/get-back tradeoffs, long rebounds, deterministic legacy hashes and full-game accounting must fail first.
- [x] Add possessionModel.ts / possessionTypes.ts, integrate match.ts behind possessionVersion.
- [x] Verify domain and seeded match tests.

### Task 2: Frozen input plumbing and reports
- [x] Add failing save/local/archive flag tests and insight aggregation/UI tests.
- [x] Propagate optional version through creation, validators and archives; default new seasons only.
- [x] Add game/season possession insight tables and explanatory definitions.
- [x] Run focused tests, full suite and build; inspect balance and desktop/mobile UI.

### Task 3: Review and delivery
- [x] Fresh reviewer checks delta against snapshot and spec.
- [x] Fix substantive findings with regression tests.
- [x] Prepare verified integration without overwriting concurrent work; deliver commits and verify remote.

## Execution notes
Baseline current working snapshot: 19 focused tests passed. Native isolated worktree, original shared files preserved. Implementation and tests follow the task ordering; author performs inline work.

Reviewed fixes: a kickout now clears putback state (seed-4 regression RED→GREEN); unavailable detail names both historical and manually played games (UI regression RED→GREEN). The reduced-motion test now allows 20 seconds, matching its existing 15-second inner wait rather than the runner default of five. Desktop/mobile reports and playoff reload checked on a separate QA origin; original user save untouched.

Final verification: 775 cases covered. Broad run: 763 passed, nine deadline failures and three fixed-seed rival-counterexample mismatches. All twelve passed targeted reruns after test-only changes: season reconstruction deadlines now cover the measured work; exact historical rival examples explicitly retain their original rules. New-rule local careers remain covered by archive, two-year type/depth tests and browser validation. Production build passed; 1,000-game seeded audit completed; 60 pre-change games replayed byte-for-byte. Independent review's two findings were both fixed and regression-tested. Browser QA included four-team drafting, season insights, playoff box detail/reload, offseason rookies, year two and 390px layout without page overflow.
