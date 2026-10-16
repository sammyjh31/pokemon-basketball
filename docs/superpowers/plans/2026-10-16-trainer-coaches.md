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
- [ ] Write/run failing tests for 32 distinct coaches, stable three offers, unique CPU assignments, invalid identities, roster-sensitive distinct plans and score/energy adjustments.
- [ ] Implement deterministic catalog/policy without changing historical defaults.
- [ ] Run focused checks; commit and push.

## Task 2: Shared game integration

Modify `match.ts`, `matchLineups.ts`, `courtPossession.ts`, `engineInsightsTypes.ts`; add `trainerMatch.test.ts`.
- [ ] Test current coach outcomes, compact/full parity, symmetric deterministic plans, style-sensitive lineups/coverage, input immutability, clocks/minutes and uncoached fixture equality.
- [ ] Apply opening plans to cloned configs; independent observations drive bounded live adjustments. Coach preferences enter actual lineup and coverage decisions. Record opening and adjustment evidence without introducing report-only RNG.
- [ ] Run new and existing core tests, audit legacy fixtures; commit/push.

## Task 3: Selection lifecycle and persistence

Create `coachSelection.ts`; modify state, league, franchise/archive/validation/persistence and local league/career; add `coachSelection.test.ts` and `coachPersistence.test.ts`.
- [ ] Test offered versus unrestricted choices, pregame/started-season guards, coach retention, old-save omission, corrupt/duplicate assignments and local human/CPU availability.
- [ ] Wire new draft selection and existing-franchise hiring, all CPU assignments, frozen snapshots and strict validation. Pending offseason hiring applies only when the following season starts.
- [ ] Round-trip real partial seasons and archived coach games; run lifecycle regressions; commit/push.

## Task 4: Draft and automatic coaching UI

Create `CoachDraft.tsx`, `CoachSummary.tsx`, `TrainerCoachInsights.tsx` and styling/tests. Integrate App, local draft/mode, franchise panel, bench, rotation and game insights.
- [ ] Test three offers/catalog search, selection, taken coaches, automatic-plan display and no mandatory manual coaching controls.
- [ ] Expose coach selection, persistent summary and actual game decisions. Preserve existing manual controls for frozen uncoached seasons. Gate new draft simulation until its coach has been chosen.
- [ ] Test UI, build and inspect desktop/mobile in the supported browser without changing the user's save; commit/push.

## Task 5: Review and delivery

- [ ] Run complete suite; repair actual regressions and run meaningful targeted follow-ups.
- [ ] Run varied-coach audit and old replay comparison; inspect performance and accounting.
- [ ] Fresh-context review, repair findings, update README/handoff and execution evidence.
- [ ] Integrate latest main safely, push main, verify remote SHA and active local preview.

## Execution rulings

- Approved spec and explicit “go ahead and build it” authorize implementation; no extra plan approval gate.
- Preserve low-level uncoached constructors for exact historical fixtures; the interactive new-draft flow explicitly requests coach selection, while assignment activates the versioned coach policy.
