# Coach Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

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

- [x] Write behavioral tests for style, role, strengths/weaknesses, needs, workload, determinism, legacy fallback, malformed metadata and actual league development.
- [x] Run `npm test -- --run src/game/coachTraining.test.ts`.
  Expected: FAIL because policy is absent.
- [x] Implement pure policy, integrate both offseason processors and metadata parsers. Extend existing real local season/reload test for archived plans and old saves.
- [x] Run `npm test -- --run src/game/coachTraining.test.ts src/game/coachPersistence.test.ts src/game/franchiseFeaturesState.test.ts`.
  Expected: PASS.
- [x] Commit policy and integration.

### Task 2: Automatic plan UI and delivery

**Files:** new components/CoachTrainingPanel.tsx and its test; update FranchisePanel, LocalLeagueMode, LocalCareerPanel, OffseasonReport, CoachSummary, CoachOfficePanel and docs.

**Interfaces:** Consumes Task 1 assignments; CoachTrainingPanel(team, players?) renders previews; CoachTrainingDetails(assignment) renders archived reasons.

- [x] Write UI tests for eight automatic plans, read-only controls, next-camp timing and saved report attribution.
- [x] Run `npm test -- --run src/components/CoachTrainingPanel.test.tsx`.
  Expected: FAIL because panel is absent.
- [x] Implement previews and frozen report details; preserve manual fallback and update scope copy/docs.
- [x] Run `npm test -- --run src/components/CoachTrainingPanel.test.tsx src/components/Coaching.test.tsx src/components/CoachOfficePanel.test.tsx` and `npm run build`.
  Expected: PASS.
- [x] Review a disposable browser fixture, never the user save; capture screenshot. Run one fresh whole-change review and resolve material findings with regressions.
- [x] Commit and push main, verify remote SHA.

## Execution record

Implemented in the existing trainer-coach worktree. Policy/integration committed as fbc9757; UI/history display committed as 96e0d48. Native implementation with one independent final review; no material findings. Numerical balance remains a matter for future play feedback.

Verification: 11 policy/local-persistence/state tests, 11 interface tests, 2 full solo franchise tests, and the exact legacy replay hash passed (25 selected tests total). Production build passed; existing bundle-size advisory remains. Browser fixture passed desktop and 390px checks, no horizontal overflow or console errors. Screenshot: docs/design/coach-training.png. Disposable QA files/server/tabs were removed; user saves and the live 5173 server were preserved.

The solo test now includes actual offseason development. Metadata corruption/legacy checks use preliminary structural validation; full restore still reconstructs the saved season and playoffs. The complete integration case took 171 seconds on this shared host, exceeding the previous 120-second watchdog; its test budget is now 240 seconds. No application simulation work or assertions were skipped.

Completed reports remain immutable. Training policy changes affect the next unprocessed camp, and incoming coaches direct future camps. No match-engine or RNG version changed. Push directly to main under the user's standing authorization; retain the live worktree.
