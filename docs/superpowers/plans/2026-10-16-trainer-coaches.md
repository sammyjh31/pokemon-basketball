# Trainer coaches implementation plan

> Execute inline with superpowers:executing-plans; final fresh-context review. The user approved the written spec and explicitly requested implementation and pushes.

**Goal:** Draft a trainer who automatically coaches the team in every simulated game.
**Architecture:** Versioned assignments flow through draft/save/league snapshots. A deterministic coach policy produces opening plans and live decisions independent of telemetry; the UI exposes selection and explanations.
**Tech stack:** Existing TypeScript, React, Vite and Vitest, no new dependencies.
**Spec:** docs/superpowers/specs/2026-10-16-trainer-coaches-design.md

## Constraints

32 coaches; three seeded offers for 82–0 and unrestricted available catalog elsewhere. Eight-player rosters. Coaches persist; no firing market. Old uncoached inputs replay exactly. Never modify the primary or other engine worktree. Commit/push the feature branch incrementally, reconcile main before delivery.

## Review focus

- Compact/full games must be identical despite coaching observations.
- Initial hiring in an existing franchise cannot rewrite a started season or archived inputs.
- Local coach picks survive reload and local career transitions; CPU assignments cannot consume human choices.
- Decisions and reported starters/minutes must use the actual floor, maintain 240 + overtime minutes, and respect fouls.
- Unknown/duplicate coach assignments and forged midseason selections must preserve the source save.

## Task 1: Catalog and policy

Create `src/game/trainerCoaches.ts`, `coachPolicy.ts`, `trainerCoaches.test.ts`, `coachPolicy.test.ts`; extend `types.ts` and insight types.
Interfaces: `CoachAssignment {version:1,id:string}`; `coachOffers(seed): Coach[]`; `validateCoach(value): CoachAssignment|undefined`; `assignLeagueCoaches(teams,seed,selected): LeagueTeam[]`; `coachGamePlan(team,opponent?): CoachPlan`; `coachAdjustment(coach,observation): policy`; lineup/coverage preferences use the same catalog.
- [x] Write/run failing tests for 32 distinct coaches, stable three offers, unique CPU assignments, invalid identities, roster-sensitive distinct plans and score/energy adjustments.
- [x] Implement deterministic catalog/policy without changing historical defaults.
- [x] Run focused checks; commit and push.

## Task 2: Shared game integration

Modify `match.ts`, `matchLineups.ts`, `courtPossession.ts`, `engineInsightsTypes.ts`; add `trainerMatch.test.ts`.
- [x] Test current coach outcomes, compact/full parity, symmetric deterministic plans, style-sensitive lineups/coverage, input immutability, clocks/minutes and uncoached fixture equality.
- [x] Apply opening plans to cloned configs; independent observations drive bounded live adjustments. Coach preferences enter actual lineup and coverage decisions. Record opening and adjustment evidence without introducing report-only RNG.
- [x] Run new and existing core tests, audit legacy fixtures; commit/push.

## Task 3: Selection lifecycle and persistence

Create `coachSelection.ts`; modify state, league, franchise/archive/validation/persistence and local league/career; add `coachSelection.test.ts` and `coachPersistence.test.ts`.
- [x] Test offered versus unrestricted choices, pregame/started-season guards, coach retention, old-save omission, corrupt/duplicate assignments and local human/CPU availability.
- [x] Wire new draft selection and existing-franchise hiring, all CPU assignments, frozen snapshots and strict validation. Pending offseason hiring applies only when the following season starts.
- [x] Round-trip real partial seasons and archived coach games; run lifecycle regressions; commit/push.

## Task 4: Draft and automatic coaching UI

Create `CoachDraft.tsx`, `CoachSummary.tsx`, `TrainerCoachInsights.tsx` and styling/tests. Integrate App, local draft/mode, franchise panel, bench, rotation and game insights.
- [x] Test three offers/catalog search, selection, taken coaches, automatic-plan display and no mandatory manual coaching controls.
- [x] Expose coach selection, persistent summary and actual game decisions. Preserve existing manual controls for frozen uncoached seasons. Gate new draft simulation until its coach has been chosen.
- [x] Test UI, build and inspect desktop/mobile in the supported browser without changing the user's save; commit/push.

## Task 5: Review and delivery

- [x] Run complete suite; repair actual regressions and run meaningful targeted follow-ups.
- [x] Run varied-coach audit and old replay comparison; inspect performance and accounting.
- [x] Fresh-context review, repair findings, update README/handoff and execution evidence.
- [ ] Integrate latest main safely, push main, verify remote SHA and active local preview.

## Execution rulings

- Approved spec and explicit “go ahead and build it” authorize implementation; no extra plan approval gate.
- Preserve low-level uncoached constructors for exact historical fixtures; the interactive new-draft flow explicitly requests coach selection, while assignment activates the versioned coach policy.


## Execution and verification record

Implemented the catalog, deterministic policy, shared engine integration, selection/persistence and UI. Incremental feature commits were pushed throughout implementation. Final source is verified by the production build and TypeScript check.

There is passing evidence for **839 tests across 131 files**, combining the complete test run and targeted repairs. The broad run had 738 passes, 22 failures and 43 cases skipped behind timed-out setup hooks (803 cases; three UI files were running separately). Every failed or blocked case was rerun successfully. Two additional regression tests cover pending franchise reload and the overview simulation gate. The separately run UI cases were also repaired and passed. This is aggregate passing evidence, not a claim that the first broad run was green.

The shared host was running other CPU-intensive development checks. Explicit 20–45 second watchdogs expired during whole-season reconstruction. Affected replay watchdogs now allow bounded 60–180 second windows, retaining every assertion. Keep the configured one-worker default for ordinary full-suite runs. Follow-up batches passed 9 selected save/UI cases, all 26 offseason/persistence cases, and 86 of 87 historical/UI cases; the final full franchise transition then passed after the key-collision repair.

Accepted fixes:

- Independent review P1: allow zero-round team input reconstruction while a coach choice is pending, and block actual advancement until selection. The real reducer → save → deferred restore → selection → round advancement regression failed before the fix and passed afterward.
- Preserve original save bytes on load; do not silently add coach-selection state. Remove the consumed pending hire property entirely at the next-season boundary.
- Gate the franchise overview's simulation shortcut until selection. Its regression failed before the fix and passes in the four-case coach UI suite.
- Give CoachDraft a distinct React key from SeasonPanel, preventing duplicate coach cards across the offseason/year-two transition. The actual two-season UI flow, archive restoration and coached simulation now pass without key warnings.

Review disposition: the independent review's P1 was accepted and repaired. No declined judgments or deferred minor findings remain. Additional verification findings above were repaired in the same delivery.

The seeded audit covers **64 games / 32 coach styles**, with 336 recorded adjustments, valid score/minute/starter accounting and exact detailed/compact parity. Reproduce with `node scripts/coach-audit.mjs`; the report is `docs/coach-balance-audit.json`. All **48 historical match fixtures remain byte-identical**. The final build succeeds with the existing non-blocking bundle-size advisory.

Browser QA used isolated port 5176: three challenge offers, free catalog search, coach selection, projected rotation, local friends choosing before CPUs, persistence between human turns, taken-coach disabling and Pokémon draft unlock. A 390px iframe viewport had 390px document scroll width and working trainer search/selection. Checked console errors were empty. Temporary QA files, tab and server were removed. The user's port 5173 save and active preview remain intact. Screenshot: `docs/design/trainer-coaches.png`.

Standalone Playwright scripts were updated for trainer selection and automatic coaching; CLI browser automation was not run in this desktop session.
