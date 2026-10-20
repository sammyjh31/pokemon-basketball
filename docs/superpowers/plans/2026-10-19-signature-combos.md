# Signature Moves and Combo Plays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatic species/type signature moves and actual two-player combo plays chosen from mastery and chemistry in every shared simulated game.
**Architecture:** Extend the existing optional moves rules to version 2. Pure catalogs/policies feed a match-local combo runtime and existing court actions; optional exact telemetry aggregates through existing history and reporting.
**Tech Stack:** Existing TypeScript/React/Vite/Vitest/Playwright, no new dependencies.
**Spec:** docs/superpowers/specs/2026-10-19-signature-combos-design.md

## Global Constraints
- Preserve absent/v1 moves behavior, both released hashes and court rules 4. New defaults/season boundaries adopt 2; local historical transitions reconstruct their recorded versions.
- Existing mastery bank only. Type signature 25 XP, species signature 100 XP; combo requires each member 25 XP. Existing 2/3/4 slots and specializations unchanged.
- Actual actions, finite energy and elapsed cooldowns; no extra RNG draws, invented baskets, bench contributions or cross-segment completions. Real source histories and official arcade rules remain intact.
- Worktree /Users/sam/.codex/worktrees/pokemon-matchup-engine/PokeBBall; primary dirty checkout untouched. Baseline c7ae044. Inline implementation, one independent whole-branch review; Git updates explicitly authorized.

## Review Focus
- Trading a veteran/rookie must use species XP and real teammate bonds, not the replaced slot's mastery; test incoming projections in task 1 and transactions in task 4.
- Offscreen mobile reports and disabled ability/chemistry rules must not imply actual active combos; task 5 tests visibility/empty histories and task 3 tests neutral rules.
- A paid setup interrupted by turnover/clock/incorrect receiver must stay an attempt; no fake completed shot. Task 2 runtime tests and task 3 actual-event audit.
- Old v1 local history followed by v2 must replay the original flag and exact totals; task 4 mixed-version cold/warm and tamper tests.
- Shared evaluation/training must stay bounded and not recurse or make market search quadratic in catalogs; task 1 projection bounds and task 4 coach integration.

### Task 1: Signature and pair catalogs/policies
Files: modify moveTypes/basketballMoves/movePolicy; create signatureMoves.ts, comboTypes.ts, comboPolicy.ts; signaturePolicy.test.ts.
Interfaces: movePool(id, version=1), signatureMovesForSpecies(id); coachCombos(team, includeLocked=false): ComboAssignment[] (max 8); comboValue(team,id,profile?,xp?) and comboTrainingFocus(team,id) pure/bounded. MoveTeam gains optional chemistry fields; known move/combination IDs are fixed catalogs.
- [x] Write/run failing tests for all-type coverage, exact species/family restrictions, 25/100 unlocks, v1 unchanged, coach/style/chemistry/mastery-sensitive pair ranking and incoming XP/fit bounds.
- [x] Implement catalogs and pure selection, retain v1 score arithmetic and output keys. Typecheck and focused old/new policy checks.
- [x] Record evidence, commit/push independently testable catalog/policy deliverable.

### Task 2: Combo runtime and exact counters
Files: new matchCombos.ts/comboTelemetry.ts, modify matchMoves/moveTelemetry; signatureRuntime.test.ts, comboRuntime.test.ts, comboTelemetry.test.ts.
Interfaces: createComboRuntime(team), comboPlayWeights(runtime,active,now), beginComboSegment(runtime), startCombo(runtime,kind,from,to,now,context), noteComboPass(runtime,from,to), completeCombo(runtime,shooter,zone,now). Structural player inputs carry move state, energy and box identity; optional stats.combos holds attempts/shotsCreated by known play ID.
- [x] Write/run failing tests for signatures' physical/pass/contest effects and actual energy/receiver requirements, 25 XP pair gate, active identity, interrupted followthrough, wrong zones, segment expiry, clock, cooldown/bench and ability-off behavior.
- [x] Implement capped v2 effects and actual per-player costs/counters; preserve legacy parsing/key order when absent. Reject unknown/impossible/fractional combo stats and reconcile exact mixed history.
- [x] Typecheck, old v1 frozen game hash plus runtime/telemetry groups; record and commit/push.

### Task 3: Court and automatic play timing
Files: match.ts/matchLineups.ts/courtPossession.ts/courtTypes.ts/types.ts; signatureSimulation.test.ts.
Interfaces: optional Team.combos/CourtContext.combos; actual CourtSequence.combos setup/shot events, LeagueMatch.comboAssignments. Coach plan weights and bounded receiver preferences use only ready active pairs.
- [x] Fail real seeded detailed/compact games first: actual signatures and combos, every combo shot backed by correct setup/pass/zone, no violation/turnover completion, points/totals conserved and repeatable; disabled versions neutral.
- [x] Hook only committed screens/passes/kickouts and committed shots. Mark successful pass only after interception resolution; reset segments without clearing cooldowns. Freeze derived assignments on detailed match reports.
- [x] Verify unchanged v1 hash and focused physical/court/official regressions; record and commit/push.

### Task 4: Version lifecycle, coaching, training and saved careers
Files: types/draft/league/franchise/archive/persistence/franchiseValidation/localLeague/localCareer/abilityMastery/coachTraining/teamEvaluation and boundary fixtures; signatureRules.test.ts/signatureCoaching.test.ts/signatureLifecycle.test.ts.
Interfaces: movesetVersion 1|2 with isMovesetVersion; nextYearTeams adopts recorded version on replay, current 2 otherwise. Existing moveValue stays <=3; combo projection adds <=0.4 inside that bound. Completed combo participation adds at most two*0.03 existing XP before current game caps; automatic practice uses pair role and upcoming signatures within existing reason bound.
- [x] Fail new-mode defaults, prerequisites, invalid/mixed versions, training/value/XP integration, incoming roster ownership and old-v1/new-v2 cold/warm history tamper cases.
- [x] Implement chronological version propagation and existing-bank training/transaction retention without extra save currency or per-fixture plan storage. Update only new-season expectations/explicit historical fixture flags, never released hashes.
- [x] Real new solo/local season/playoff/camp/transaction restoration, zero warm historical work, exact old archive identity; record and commit/push.

### Task 5: Reports and final verification/release
Files: MovesetPanel.tsx/LeagueBoxScore.tsx/RulesPanel.tsx plus report component as needed; component tests, tests/e2e/signatureCombos.spec.ts, README/handoff.
- [x] Fail report tests for locked/unlocked signatures, planned pair reasons/mastery/chemistry and actual attempts/shots-created (no invented makes), absent legacy/disabled states and frozen game plans.
- [x] Implement accessible compact reports with existing styles; desktop/mobile actual event/counter parity and no overflow. Build/typecheck.
- [x] One fresh independent whole-branch review; fix substantive findings with red/green regressions. Complete regression sweep and browser flows, retain exact scope/evidence, no repeated full sweeps for only test fixture corrections.
- [ ] Commit/push release record, create/attach/merge PR with exact head and confirm local/remote trees. Preserve preview and unrelated data.

## Ledger
- Baseline c7ae044: previous feature has 1,392-test coverage (complete sweep plus two focused expectation corrections), 52 browser-flow coverage (complete sweep plus focused test-only corrections) and production build. Fresh current baseline: TypeScript plus 17 move policy/runtime/rules/v1 fingerprint checks passed, four files, 3.25 s.
- Reused existing linked managed worktree; clean except existing dependency symlink. New branch codex/signature-combo-plays. No new worktree or primary-checkout changes.
- Execution: same authorized inline implementation/Git workflow as prior feature. Version 2 is an extension of the existing move subsystem; no separate cascading signature flags. Compatibility work explicitly includes old v1 archives and recorded local transitions.
- Pre-flight shared interfaces: catalog IDs/effects feed runtime; ComboAssignment feeds court and reports; optional stats feed strict aggregation/validation; rules version feeds all modes. Policies import no shared evaluation/coachPolicy consumers, preventing a cycle. All task interfaces align with the spec.
- Task 1: missing-module test failed first; the behavioral run then failed specifically on unlocked signature selection and training a player outside the current top-eight pair plans. Implemented 18 type/14 family catalogs and exact 25/100 thresholds. Pair practice considers a player's best prospective partnership even if it is not in the current game playbook, so reserves can learn their role. TypeScript passed. Five-file group passed 22 tests (4.06 s), including released moveset-v1 SHA unchanged. Incoming projected XP remains independent of roster slots; valuation stays capped and policies do not import consumer evaluation/coach modules. No runtime or new-run defaults changed yet.
- Task 2: runtime tests failed first on missing combo hooks, inert signature effects, missing pass receiver/mastery gates and optional combo telemetry parsing. Implemented actual paired costs, 100-second player cooldowns, per-segment interruption, successful-pass followthrough, zone checks and exact participant counters. A subsequent red/green readiness check prevents playbook bias for unusable plans and non-finite energy. Drive-and-kick planning favors isolation (which can actually drive), instead of a set-shot possession. TypeScript passed; seven-file runtime/legacy group passed 27 tests (4.86 s), retaining released v1 SHA. Legacy stats retain their exact three-key shape; optional combo counters merge and reconcile independently of old summary-only histories. Runtime is not connected to matches until task 3.

- Task 3: real seeded audits exposed rotation cache cross-version reuse and shot credit being granted before later pressure/non-shooting-foul cancellation. Both now have red/green regressions. V2 shot moves and combo completion defer until the actual shot survives those checks; v1 timing stays frozen. Active-five chemistry affects combo timing/strength, and a ready drive-kick pair can reserve its move opportunity. Typecheck passed; integration/runtime/v1 group 19 tests passed (4.29 s), seven-file court/physical/official/v1 group 31 tests passed (5.20 s). Detailed/compact parity, exact participant energy/counters, immutable inputs and released v1 SHA remain verified.

- Task 4 progress: new-mode defaults, strict version propagation and bounded coach training/XP checks passed (13 checks/5 files, 3.73 s); CPU-wide saved training report bounds passed. Typecheck and production build passed. Mixed v1/v2 cold/warm local restore retains identical game data (object comparison; parsing normalizes key order) and zero warm replay. The full solo test reproduced a real camp verifier mismatch: v2 combo practice used final earned familiarity while mastery chronology reconstructed opening familiarity. The verifier now uses the independently verified final chemistry bank and syncs bonds after trades; focused and real solo restoration reruns are in progress. The first five-file lifecycle run also passed existing v1 solo, local and frozen full-v4 checks (four tests); no released hash changed.
- Task 5 progress: reporting tests failed first on absent v2 panel/signature counters and missing game pair report. Three report/application files passed 8 checks, including legacy/disabled visibility. Production build passed. UI work overlapped only the independent lifecycle verification, after the game interfaces were stable.

- Follow-up evidence: desktop/mobile actual-action and rendered report checks passed (2/2, 5.7 s), including exact two-participant setup/shot counters and no horizontal overflow. Initial browser failures were test-only text selectors matching the fixture and hidden app; scoping to the visible panel fixed them. Fast signatureChronology regression passes with a real difference in camp XP caused by earned pair familiarity, accepts the verified bank and rejects the opening bank substituted for it. No production change since 71ba6ec.

- Task 4 complete: corrected final-chemistry camp reconstruction passed the real full solo season/playoffs/camp/cold+warm restore, mixed v1/v2 local history and legacy chronology group (4 tests/3 files, 221.12 s); warm restore performs zero archived work. Separate fast final-familiarity regression passes (1.18 s), including rejection of a substituted opening-day bank. V1 solo/local and full-v4 SHA already passed the initial lifecycle run. New default-only test expectations use v2; explicitly saved v1 fixtures and all released hashes remain unchanged.

- Independent whole-branch review: one Important finding, no Critical/Minor findings and no declined judgments. Confirmed wrong-receiver interruption could rearm a paid setup. Regression observed a false completed shot first; fixed with a permanent cancellation marker retained until the next segment, preserving attempt/energy/cooldown and preventing a second pair setup. Receiver preference also stops on cancellation. Six-file runtime/actual-game/signature/telemetry/v1/chronology group passed 27 checks (13.94 s). Added actual court-chain audit requiring the one matching setup pass for every credited shot. Full regression and browser sweeps follow the single review fix pass.

- Full sweep follow-up in progress: two long tests reached existing time limits under two workers (CPU free-agency year-two history, 600 s; repeated full-season simulation, 120 s); both will be rerun separately with the original limits and one worker after the sweep. A local-trade fixture also assumed club 0 always accepts a swap from a first-available-Pokédex human roster. Actual evaluation showed all 64 offers correctly declined (best CPU gain -0.1724 vs -0.15 floor). The test now gives the human competitive, legal draft choices and searches available CPU clubs; real accepted/rejected trades and full save round-trip pass (5.59 s). Gameplay rules are unchanged. Full local-career file recheck follows the completed sweep to cover the optional fixture strategy.

- Unit verification complete: **1,429 active tests / 266 files covered**, one existing optional maximum-size stress case skipped. The complete sweep ran 6,855.49 s: 1,426 passed, two timeouts under two workers and the obsolete local-trade fixture assumption failed. The corrected entire local-career file passed 17/17 (136.94 s). Both timeout cases passed unchanged at one worker (703.54 s including setup): CPU free-agency year-two history 493.521 s under its original 600 s limit; repeatable full seasons 84.985 s under the original 120 s limit. These are a complete sweep plus focused rechecks, not an all-green single complete run. Gameplay code remains unchanged since 0ec26cf. The complete sweep passed the new real solo signature/combo season, mixed v1/v2 local history, all-four-combo actual-game audit and both released v1/full-v4 fingerprints. Full desktop/mobile browser verification is now running separately.

- Browser verification complete: **54 desktop/mobile flows covered**. The complete run passed 53/54 (1,884.620 s); the desktop contrast flow was interrupted by a Vite disconnect/reconnect and full-page reload while waiting for the season reveal. Its unchanged isolated desktop recheck used a fresh test server and passed in 70.690 s. The mobile counterpart and both signature/combo flows passed in the complete run. This is complete-sweep coverage plus an isolated infrastructure recheck, not a second all-green complete run. No browser test deadlines or production rules changed. Final TypeScript/production build, Prettier for changed code, and whitespace checks passed. Independent review has no unresolved findings, minor findings or declined judgments.
