# Basketball Movesets Implementation Plan

> **For agentic workers:** Execute inline with superpowers:executing-plans; TDD per task and one fresh whole-branch reviewer at the end.

**Goal:** Coach-managed basketball moves and mastery specializations affect all newly simulated modes with exact historical replay.

**Architecture:** Independent moveset rule flag, pure coach/loadout policy, match-local action runtime, existing persistent mastery/telemetry and validators.

**Tech Stack:** Existing TypeScript/React/Vite, Vitest, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-19-basketball-movesets-design.md`

## Global constraints

- Preserve prior flags/seeded outcomes and source history; absent moveset flag produces no new draws, fields or effects.
- Coaches manage everything; two slots initially, three at 200 XP, four at 400 XP; specialization at 75 XP.
- Reuse existing mastery, roster transfers and camp provenance; do not invent counters for official arcade games.
- Bounded costs, effects, cooldowns and work per possession. Automatic replay-cache revision invalidation remains intact.

## Review focus

- Returning local careers must adopt the new flag only across a season boundary, without rewriting earlier teams.
- Costs/cooldowns must use actual time and effects must not leak to benched/inactive players or later possessions.
- Ability-disabled and pre-feature saved inputs must remain byte-identical.
- Telemetry aggregation, career totals and archive replay must reject altered move counts and retain prior rows.
- Training/evaluation/loadout policy must agree and cannot recurse through coach/shared evaluation.

## Tasks

### 1. Catalog and automatic mastery policy
Files: new `basketballMoves.ts`, `movePolicy.ts`, `moveTypes.ts`, tests. Interfaces: pure `coachMoves(team,id)` returns equipped moves/path/reasons; `movePool(id)`; `moveTrainingFocus(team,id)` and bounded move valuation. Inputs include roster/style/development/XP but no match future state. No coachPolicy/teamEvaluation import cycle.
- [x] Write/run failing selection, species eligibility, unlock, style/need and efficiency/power tradeoff tests.
- [x] Implement catalog/policy and version predicate; run focused tests; commit/push.

### 2. Shared match runtime and telemetry
Files: new `matchMoves.ts`, `matchLineups.ts`, `match.ts`, `courtPossession.ts`, `courtTypes.ts`, `abilities.ts`; tests. Interface: players optionally carry match-local move state; `activateMove(player, opportunity, actualSeconds, context)` returns bounded effects/events, records actual costs and uses. A segment clears temporary effects; elapsed match time advances cooldown.
- [ ] Fail real-action/cooldown/energy/expiry/no-flag tests first, then implement shared resolution hooks.
- [ ] Add strict optional move telemetry merge/validation; actual game report and court events.
- [ ] Verify real same-seed repeatability, disabled behavior and frozen v4 hash; commit/push.

### 3. Mode propagation, progression, coaching and save integrity
Files: types/draft/league/localLeague/localCareer/franchise/validation/persistence; coachTraining/teamEvaluation; integration tests.
- [ ] Fail new-mode flags, next-season adoption, old archives, altered telemetry and trade/XP retention tests.
- [ ] Propagate optional flag using existing independent flag patterns; local nextYearTeams adoption argument is inferred from recorded next-year rules during validation.
- [ ] Add move focus/value to automatic coaching/training/shared evaluation, gated by flag. Use existing mastery and camp streams.
- [ ] Verify real solo/local/playoff lifecycle and warm restored output parity; commit/push.

### 4. Clear automatic reports
Files: new MovesetPanel/report, MasteryPanel, AbilityStats/LeagueBoxScore and tests; rules/help copy.
- [ ] Fail UI tests for equipped moves, specialization tradeoffs, automatic training, unlocks and actual usage.
- [ ] Implement informative profiles and box reports without manual controls; optional fields remain absent from historical reports.
- [ ] Run focused UI, desktop/mobile browser checks and build; commit/push.

### 5. Review, complete verification and release
- [ ] One fresh independent read-only whole-branch review; address proven findings with regressions.
- [ ] Full required regressions, frozen season fingerprint, native warm-cache/lifecycle and browser checks on final code; build/typecheck.
- [ ] Update README/handoff and exact verification record, commit/push and create/attach/merge PR under existing authorization. Keep local preview available.

## Ledger

- Baseline c5987ec: immediately preceding task passed 1,364 tests/245 files, 50 desktop/mobile checks and production build; frozen v4 season and restored-output hashes recorded in performance docs. Existing checkout is the managed isolated preview worktree; reuse it on codex/basketball-movesets. Primary checkout contains unrelated work and remains untouched.
- User intent is explicit: implement the previously proposed two features with automatic coaching in all simulated modes and push updates. Ruling: proceed inline under that authorization; concrete spec/plan document the design without adding approval round trips for routine choices. Independent movesetVersion preserves prior court rules and avoids retroactive simulation changes.
- Specialization is a coach assignment from unlocked paths, re-evaluated from frozen pregame inputs. This avoids an extra progress currency or irreversible new player bank while preserving XP through all existing lifecycle paths. These assignments and tradeoffs must be visible.

- Task 1: missing-policy/catalog tests failed first; all four policy tests now pass across the full franchise species pool, with real Ash/Surge/Oak coach policies, deterministic equipped slots and specialization tradeoffs. Typecheck passed. No shared evaluation/coach recursion or new saved XP bank.
