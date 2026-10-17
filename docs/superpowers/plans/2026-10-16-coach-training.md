# Coach Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coaches automatically assign meaningful individual development plans across solo and local franchises.

**Architecture:** A pure coachTraining policy returns versioned assignments per player. Offseason processors consume and archive these assignments; UI derives previews without changing replay inputs.

**Tech Stack:** TypeScript, React, Vitest, Vite.

**Spec:** docs/superpowers/specs/2026-10-16-coach-training.md

## Global Constraints

- Preserve uncoached manual training and old report compatibility.
- No extra random draws or match-engine changes.
- Camp resolves before staff changes; frozen reports retain the outgoing coach.
- Work in the existing pokemon-matchup-engine worktree; preserve live user saves.
- Commit and push to GitHub main after verification.

## Review Focus

- A newly hired coach must not relabel completed development.
- CPU and human clubs must use identical training rules.
- Development offsets and roster moves must affect future previews.
- Old saves without coach metadata must reload without invented history.
- Malformed training assignments must fail validation, not silently disappear.

### Task 1: Policy, offseason integration and persistence

**Files:** new game/coachTraining.ts and coachTraining.test.ts; update training.ts, developmentTypes.ts, offseason.ts, localCareer.ts, franchiseValidation.ts and coachPersistence.test.ts.

**Interfaces:** Produces CoachTrainingAssignment {version:1, coachId:string, plan:PlayerTrainingPlan, reasons:string[]}, coachTrainingPlans(team:LeagueTeam, players?:LeaguePlayer[]) and validateCoachTraining(value:unknown, expectedCoach?:string|null). Optional training metadata on solo/local development rows.

- [ ] Write behavioral tests for style, role, strengths/weaknesses, needs, workload, determinism, legacy fallback, malformed metadata and actual league development.
- [ ] Run `npm test -- --run src/game/coachTraining.test.ts`.
  Expected: FAIL because policy is absent.
- [ ] Implement pure policy, integrate both offseason processors and metadata parsers. Extend existing real local season/reload test for archived plans and old saves.
- [ ] Run `npm test -- --run src/game/coachTraining.test.ts src/game/coachPersistence.test.ts src/game/franchiseFeaturesState.test.ts`.
  Expected: PASS.
- [ ] Commit policy and integration.

### Task 2: Automatic plan UI and delivery

**Files:** new components/CoachTrainingPanel.tsx and its test; update FranchisePanel, LocalLeagueMode, LocalCareerPanel, OffseasonReport, CoachSummary, CoachOfficePanel and docs.

**Interfaces:** Consumes Task 1 assignments; CoachTrainingPanel(team, players?) renders previews; CoachTrainingDetails(assignment) renders archived reasons.

- [ ] Write UI tests for eight automatic plans, read-only controls, next-camp timing and saved report attribution.
- [ ] Run `npm test -- --run src/components/CoachTrainingPanel.test.tsx`.
  Expected: FAIL because panel is absent.
- [ ] Implement previews and frozen report details; preserve manual fallback and update scope copy/docs.
- [ ] Run `npm test -- --run src/components/CoachTrainingPanel.test.tsx src/components/Coaching.test.tsx src/components/CoachOfficePanel.test.tsx` and `npm run build`.
  Expected: PASS.
- [ ] Review a disposable browser fixture, never the user save; capture screenshot. Run one fresh whole-change review and resolve material findings with regressions.
- [ ] Commit and push main, verify remote SHA.
