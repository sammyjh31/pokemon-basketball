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
- [x] Fail real-action/cooldown/energy/expiry/no-flag tests first, then implement shared resolution hooks.
- [x] Add strict optional move telemetry merge/validation; actual game report and court events.
- [x] Verify real same-seed repeatability, disabled behavior and frozen v4 hash; commit/push.

### 3. Mode propagation, progression, coaching and save integrity
Files: types/draft/league/localLeague/localCareer/franchise/validation/persistence; coachTraining/teamEvaluation; integration tests.
- [x] Fail new-mode flags, next-season adoption, old archives, altered telemetry and trade/XP retention tests.
- [x] Propagate optional flag using existing independent flag patterns; local nextYearTeams adoption argument is inferred from recorded next-year rules during validation.
- [x] Add move focus/value to automatic coaching/training/shared evaluation, gated by flag. Use existing mastery and camp streams.
- [x] Verify real solo/local/playoff lifecycle and warm restored output parity; commit/push.

### 4. Clear automatic reports
Files: new MovesetPanel/report, MasteryPanel, AbilityStats/LeagueBoxScore and tests; rules/help copy.
- [x] Fail UI tests for equipped moves, specialization tradeoffs, automatic training, unlocks and actual usage.
- [x] Implement informative profiles and box reports without manual controls; optional fields remain absent from historical reports.
- [x] Run focused UI, desktop/mobile browser checks and build; commit/push.

### 5. Review, complete verification and release
- [x] One fresh independent read-only whole-branch review; address proven findings with regressions.
- [ ] Full required regressions, frozen season fingerprint, native warm-cache/lifecycle and browser checks on final code; build/typecheck.
- [ ] Update README/handoff and exact verification record, commit/push and create/attach/merge PR under existing authorization. Keep local preview available.

## Ledger

- Baseline c5987ec: immediately preceding task passed 1,364 tests/245 files, 50 desktop/mobile checks and production build; frozen v4 season and restored-output hashes recorded in performance docs. Existing checkout is the managed isolated preview worktree; reuse it on codex/basketball-movesets. Primary checkout contains unrelated work and remains untouched.
- User intent is explicit: implement the previously proposed two features with automatic coaching in all simulated modes and push updates. Ruling: proceed inline under that authorization; concrete spec/plan document the design without adding approval round trips for routine choices. Independent movesetVersion preserves prior court rules and avoids retroactive simulation changes.
- Specialization is a coach assignment from unlocked paths, re-evaluated from frozen pregame inputs. This avoids an extra progress currency or irreversible new player bank while preserving XP through all existing lifecycle paths. These assignments and tradeoffs must be visible.

- Task 1: missing-policy/catalog tests failed first; all four policy tests now pass across the full franchise species pool, with real Ash/Surge/Oak coach policies, deterministic equipped slots and specialization tradeoffs. Typecheck passed. No shared evaluation/coach recursion or new saved XP bank.

- Task 2: runtime tests first failed for missing engine hooks; 17 action/runtime/physical/court checks passed after implementation. The real-match tests cover deterministic repeated CPU results, actual movement, scoring conservation, compact/full parity and abilities-off behavior. The frozen full v4 season fingerprint passed unchanged (71.75 s); the five-file focused sweep passed 15 tests. Move effects expire per court segment, with actual elapsed-time cooldowns, bounded energy and separate telemetry. Off-ball callbacks apply only to actual cuts/drifts.

- Task 3 progress: initial rule/coach/official tests failed as expected. New mode/header/CPU flags and invalid combinations now pass; automatic training/shared valuation and rejecting invented arcade moves pass. Two real new-rule local seasons round-trip byte-identically cold/warm with no warm historical replay; trades retain XP and slots; a legacy local archive remains byte-identical after next-year adoption. Combined lifecycle/coaching group: four passed (27.21 s), typecheck passed. Report-size regression found and fixed by combining existing skill/need explanations, retaining the eight-reason bound. Legacy rookie fixture explicitly omits moves alongside its existing omitted mastery flags. Full solo integration and broad checks still pending.

- Task 4: missing-report UI tests failed first; nine component checks passed, and the real App draft regression caught/fixed omitted move/court flags before a league exists. The focused desktop/mobile browser checks both passed with actual match events equal to usage counters, no horizontal overflow and no page errors; mobile screenshot inspected. Typecheck and production build passed. Legacy capsule helpers now explicitly omit moves when omitting prerequisite mastery/court flags; no old golden hashes changed. Fast sweep: 203/207 files passed initially; all four fixture-related failures were fixed by pinning omitted moves in their historical inputs, and the seven-file follow-up passed 19 tests.

- Review: one fresh independent reviewer found two P2 issues. The real seed-5 violation regression failed, then passed after moving shoot/defend activation into the committed-shot branch. Career move uses and both energy totals now reconcile exactly even with old summary-only years; a red/green telemetry boundary test and actual mixed-history mutation checks cover it. Reviewer rechecked fixes and reported no remaining findings.

- Solo lifecycle investigation: the real 1,230-game/playoff/camp franchise exposed an optional-key ordering mismatch in the strict career comparison. Canonicalizing the counted side through the same strict validator preserves every numeric check; the exact generated source failed before and passed after in a preliminary validator check. The full cold/warm lifecycle and complete suite are now running on final production code.

- Full solo lifecycle passed before the final canceled-drift correction (316.36 s under the three-worker full run): all 1,230 regular games, playoffs, camp, career telemetry, strict preliminary validation, cold/warm output identity, zero warm historical replay and next-season carryover. In that provisional deterministic test league, all eight move types activated; 234/240 players reached 75 XP and 174 reached 200 during the season; after camp, 14 reached 400. These are one seeded sample, not guaranteed balance targets.

- Final action audit reproduced Agility on an off-ball drift rejected for crossing inside the arc (seed 42, possession 173, player 0:121). The regression checks every cut activation against an actual cut/drift action for seeds 5/42/81. Legal baseline movement is now confirmed before activation; any extra acceleration must also remain behind the arc. The initial probe failed and passed after the fix. The reviewer inspected it and reported no findings. The preliminary complete-suite run was stopped to restart verification on this corrected engine. The provisional, unreleased moveset-v1 fingerprint was updated before the first merge; released historical fingerprints were not changed.

- Corrected engine 4b06713: 18 focused checks across five files passed (100.23 s), including the unchanged full v4 season fingerprint; TypeScript and production build passed. The full solo lifecycle passed again on this source (344.30 s), retaining cold/warm identity, zero warm historical replay and next-season history. Both corrected-source desktop/mobile move-report checks passed (56.4 s), with actual events matching counters and no overflow or page errors.

- Broad-suite investigation found a stale rookie-market assertion: a released Chikorita was legitimately CPU re-signed and appeared in two recorded roster years. The test now derives career season count from independent archived roster membership while preserving the exact first-year record and its points. The mixed official-game test exceeded its existing ten-minute deadline through repeated identical cold replays; it now earns evidence through real deferred verification, verifies the new year cold, and checks zero-replay warm reopening. Explicit replay, official boxes, synchronous partial restore, malformed progress, move forgery mutations and every history assertion remain. No deadlines, production rules or released fingerprints changed. Independent review found no issues in these test updates. The mixed official-game case passed in 365.58 s; the complete rookie-market lifecycle remains under verification.

- The complete rookie-market case reached its assertions but took 972.14 s against the unchanged 900 s deadline. Its repeated positive restores now use the genuine deferred cache too: empty records, cold partial archive with positive replay work, newly drafted ledger with zero historical replay, cold new year with positive replay work and exact warm reopening with zero work. Every original malformed-ledger mutation remains, including the cold synchronous corrupt save; the other case retains synchronous positive and corrupt full restores. The reviewer checked this extension and reported no findings. TypeScript passed; the final complete suite is running with two workers, followed sequentially by all browser checks and the production build.

- Final-suite progress: both market scenarios passed (package trade 194.60 s; complete rookie-season case 570.88 s). The mixed official archive case passed again (324.00 s), along with training/development restoration and corrupted historical-input rejection. The two reviewed test-only updates are now verified within their unchanged deadlines; the complete run remains in progress.

- Complete regression sweep finished in 6,051.20 s with two workers: 255 files, 1,390 passed, two stale next-season expectations failed, and the existing optional maximum-size stress test skipped. Both failures expected every next-season team to omit the newly adopted moveset flag. Adding `movesetVersion: 1` to those expected objects retains full roster/mastery/morale/chemistry equality, history and source-immutability checks. Independent review found no issues. Both corrected cases passed in a focused recheck (35.38 s); no production code changed. This provides complete 1,392-test coverage across the sweep and focused correction, rather than claiming a second all-green full run. Frozen v4 full-season results passed unchanged (50.68 s), and all new moveset lifecycle/runtime/policy/UI regressions passed. The full 52-check browser run is now underway; final build and release remain pending.
